/* Magic Mirror Module: MMM-TubeTimes helper
 * Version: 2.0.0
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const axios = require("axios");

/**
 * @typedef {"good"|"severe"|"warning"} TubeStatus
 */

/**
 * @typedef {Object} TFLArrival
 * @property {string} id
 * @property {number} operationType
 * @property {string} vehicleId
 * @property {string} naptanId
 * @property {string} stationId
 * @property {string} lineId
 * @property {string} lineName
 * @property {string} platformName
 * @property {string} direction
 * @property {string} bearing
 * @property {string} destinationNaptanId
 * @property {string} destinationName
 * @property {string} timestamp
 * @property {number} timeToStation
 * @property {string} currentLocation
 * @property {string} towards
 * @property {string} expectedArrival
 * @property {string} timeToLive
 * @property {string} modeName
 */

/**
 * @typedef {Object} TFLDisruption
 * @property {string} $type
 * @property {string} category
 * @property {string} categoryDescription
 * @property {string} description
 * @property {Array} affectedRoutes
 * @property {Array} affectedStops
 * @property {string} closureText
 */

/**
 * @typedef {Object} TFLNestedDisruption
 * @property {string} $type
 * @property {string} category
 * @property {string} categoryDescription
 * @property {string} description
 * @property {Array} affectedRoutes
 * @property {Array} affectedStops
 * @property {string} closureText
 */

/**
 * @typedef {Object} TFLLineStatus
 * @property {string} $type
 * @property {number} id
 * @property {string} lineId
 * @property {number} statusSeverity - Severity level: 0-20 (see statusSeverity mapping)
 * @property {string} statusSeverityDescription - Human-readable status description
 * @property {string} reason - Detailed explanation of the status
 * @property {string} created
 * @property {Array} validityPeriods
 * @property {TFLNestedDisruption|null} [disruption] - Nested disruption object if present
 */

/**
 * @typedef {Object} TFLLine
 * @property {string} $type
 * @property {string} id
 * @property {string} name
 * @property {string} modeName
 * @property {TFLDisruption[]} disruptions - Top-level disruptions array (may be empty)
 * @property {string} created
 * @property {string} modified
 * @property {TFLLineStatus[]} lineStatuses - Array of line statuses with nested disruptions
 * @property {Array} routeSections
 * @property {Array} serviceTypes
 * @property {Object} crowding
 */

/**
 * @typedef {Object} StandardizedMessage
 * @property {string} text - The message text (from reason or description)
 * @property {number} statusSeverity - Severity level (0-20)
 * @property {string} statusSeverityDescription - Human-readable status description
 * @property {string} category - Disruption category (if available)
 * @property {string} categoryDescription - Category description (if available)
 */

/**
 * Maps TFL statusSeverity numeric code to TubeStatus type
 * @param {number} statusSeverity - The numeric severity level (0-20)
 * @returns {TubeStatus} The mapped status: "good", "severe", or "warning"
 */
function mapStatusSeverity(statusSeverity) {
  // "good" statuses (green)
  if (statusSeverity === 10 || statusSeverity === 18 || statusSeverity === 19) {
    return "good";
  }

  // "severe" statuses (red)
  if ([1, 2, 3, 6, 16, 20].includes(statusSeverity)) {
    return "severe";
  }

  // "warning" statuses (orange) - default for all other relevant statuses
  // Includes: 0, 4, 5, 7, 8, 9, 11, 14, 15, 17
  // Note: 12 (Exit Only) and 13 (No Step Free Access) are station-specific and unlikely for line status
  return "warning";
}

const DBG = false;

module.exports = NodeHelper.create({
  start() {
    try {
      console.log("MMM-Tube-Times helper, started...");
      // Set up the local values
      this.result = null;
    } catch (error) {
      console.log(`[MMM-TubeTimes] ${new Date().toLocaleString()} ** bad status ** ${error}`);
    }
  },

  /**
   * @param {string} payload - The URL to fetch tube status data from
   */
  getTubeStatusData(payload) {
    this.url = payload;

    axios
      .get(this.url)
      .then((response) => {
        /** @type {{data: TFLArrival[]}} */
        const typedResponse = response;
        this.result = typedResponse.data;
        this.sendSocketNotification("GOT-TUBE-TIMES", { url: this.url, result: this.result });
      })
      .catch((error) => {
        this.result = null;
        console.error("[MMM-TubeTimes] Error fetching tube status:", error.message || error);
        this.sendSocketNotification("GOT-TUBE-TIMES", { url: this.url, result: this.result });
      });
  },

  /**
   * @param {string} payload - The URL to fetch tube line status data from
   */
  getTubeLineStatusData(payload) {
    this.serviceURL = payload;

    axios
      .get(this.serviceURL)
      .then((response) => {
        /** @type {{data: TFLLine[]}} */
        const typedResponse = response;

		// DBG && console.log('Data: ', typedResponse.data);

        if (typedResponse.data.length > 0) {
			/** @type {TFLLine} */
			const lineData = typedResponse.data[0];
			const lineStatuses = lineData.lineStatuses || [];
			const disruptions = lineData.disruptions || [];

			// Standardize messages from lineStatuses (use reason field)
			/** @type {StandardizedMessage[]} */
			const messagesFromStatuses = lineStatuses
				.filter(status => status.reason || (status.disruption && status.disruption.description))
				.map(status => ({
					text: status.reason || status.disruption?.description || '',
					statusSeverity: status.statusSeverity,
					statusSeverityDescription: status.statusSeverityDescription,
					category: status.disruption?.category || '',
					categoryDescription: status.disruption?.categoryDescription || ''
				}));

			// Standardize messages from top-level disruptions (use description field)
			/** @type {StandardizedMessage[]} */
			const messagesFromDisruptions = disruptions
				.filter(disruption => disruption.description)
				.map(disruption => ({
					text: disruption.description,
					statusSeverity: 0, // Top-level disruptions don't have severity
					statusSeverityDescription: '',
					category: disruption.category || '',
					categoryDescription: disruption.categoryDescription || ''
				}));

			// Combine all messages
			const allMessages = [...messagesFromStatuses, ...messagesFromDisruptions];

			// Deduplicate by text content using Set
			const uniqueMessagesMap = new Map();
			allMessages.forEach(message => {
				// Use text as the key for deduplication
				if (message.text && !uniqueMessagesMap.has(message.text)) {
					uniqueMessagesMap.set(message.text, message);
				}
			});

			/** @type {StandardizedMessage[]} */
			const combinedMessages = Array.from(uniqueMessagesMap.values());

			// Determine worst status from lineStatuses
			let worstStatus = "good";
			let worstSeverity = 10; // Start with "Good Service" (10)

			if (lineStatuses.length > 0) {
				for (const status of lineStatuses) {
					const severity = status.statusSeverity;
					if (severity !== 10 && severity !== 18 && severity !== 19) {
						if (severity < worstSeverity || worstSeverity === 10) {
							worstSeverity = severity;
						}
					}
				}
				worstStatus = mapStatusSeverity(worstSeverity);
			}

			this.tubeStatus = worstStatus;
			const statusSeverityDescription = lineStatuses.length > 0 ? lineStatuses[0].statusSeverityDescription : null;

			DBG && console.log('Combined Messages:', combinedMessages);
			DBG && console.log('Tube Status:', this.tubeStatus);

          this.sendSocketNotification("GOT-TUBE-LINE-STATUS", {
            serviceURL: this.serviceURL,
            tubeStatus: this.tubeStatus,
			tubeStatusDescription: this.tubeStatus !== "good" ? statusSeverityDescription : null,
			combinedMessages: combinedMessages,
          });
        } else {
			// should never reach here
          this.tubeStatus = "good";
          this.sendSocketNotification("GOT-TUBE-LINE-STATUS", {
            serviceURL: this.serviceURL,
            tubeStatus: this.tubeStatus,
			combinedMessages: [],
          });
        }
      })
      .catch((error) => {
        this.result = null;
        console.error("[MMM-TubeTimes] Error fetching tube line status:", error.message || error);
        this.sendSocketNotification("GOT-TUBE-LINE-STATUS", {
          serviceURL: this.serviceURL,
          tubeStatus: this.tubeStatus || "good",
          combinedMessages: [],
        });
      });
  },

  /**
   * @param {string} notification
   * @param {string} payload
   */
  socketNotificationReceived(notification, payload) {
    // Check this is for us and if it is let's get the data
    if (notification === "GET-TUBE-STATUS") {
      this.getTubeStatusData(payload);
    }

    if (notification === "GET-TUBE-LINE-STATUS") {
      this.getTubeLineStatusData(payload);
    }
  },
});
