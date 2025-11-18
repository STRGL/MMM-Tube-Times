/* global Module, Log */

/**
 * @typedef {"all"|"inbound"|"outbound"} TubeDirection
 */

/**
 * @typedef {"good"|"severe"|"warning"} TubeStatus
 */

/**
 * @typedef {Object} TubeTimesConfig
 * @property {string} title - Custom title to display in the module header
 * @property {number} updateInterval - Update interval in milliseconds
 * @property {number} statusUpdateInterval - Status update interval in milliseconds
 * @property {string} lineId - TFL line ID(s), can be comma-separated (e.g., "central" or "central,piccadilly")
 * @property {string} stopPointId - TFL stop point ID (e.g., "940GZZLUOXC")
 * @property {TubeDirection} direction - Direction filter: "all", "inbound", or "outbound"
 * @property {number} limit - Maximum number of journeys to display
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
 * @typedef {Object} TubeTimesPayload
 * @property {string} url
 * @property {TFLArrival[]|null} result
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
 * @typedef {Object} TubeLineStatusPayload
 * @property {string} serviceURL
 * @property {TubeStatus} tubeStatus
 * @property {string|null} tubeStatusDescription
 * @property {StandardizedMessage[]} combinedMessages
 */

Module.register("MMM-TubeTimes", {
  /** @type {TubeTimesConfig} */
  defaults: {
	title: "Tube Times",
    updateInterval: 20 * 1000,
    statusUpdateInterval: 60 * 60 * 1000,
    lineId: "central",
    stopPointId: "940GZZLUOXC",
    direction: "all",
    limit: 8,
  },

  start() {
    Log.log("Starting module: " + this.name);
	this.addFilters();

    // Set up the local values, here we construct the request url to use
    this.loaded = false;
    this.url = `https://api.tfl.gov.uk/Line/${this.config.lineId}/Arrivals/${this.config.stopPointId}?direction=${this.config.direction}`;
    this.location = "";
    this.serviceURL = `https://api.tfl.gov.uk/Line/${this.config.lineId}/Status`;
    this.tubeStatus = "good";
    this.result = null;
	this.tubeStatusDescription = null;
	this.combinedMessages = [];
	this.activeMessage = 0
    if (!this.config.limit || this.config.limit < 1) {
      this.config.limit = 8; // fallback to default
    }

    // Trigger the first request
    this.getTubeStatusData(this);
    this.getTubeLineStatusData(this);
  },

  getStyles() {
    return ["MMM-TubeTimes.css"];
  },

  /**
   * @param {Object} that - The module instance
   */
  getTubeStatusData(that) {
    // Make the initial request to the helper then set up the timer to perform the updates
    that.sendSocketNotification("GET-TUBE-STATUS", that.url);
    setTimeout(that.getTubeStatusData, that.config.updateInterval, that);
  },

  /**
   * @param {Object} that - The module instance
   */
  getTubeLineStatusData(that) {
    that.sendSocketNotification("GET-TUBE-LINE-STATUS", that.serviceURL);
    setTimeout(that.getTubeLineStatusData, that.config.statusUpdateInterval, that);
  },

  /**
   * @returns {string} Color name for border based on tube status
   */
  getTubeStatusBorderColor() {
    Log.log("Tube Status: ", this.tubeStatus);
    if (this.tubeStatus === "good") {
      return "green";
    } else if (this.tubeStatus === "severe") {
      return "red";
    } else {
      return "orange";
    }
  },

  getTemplate() {
    return "MMM-TubeTimes.njk";
  },

  getTemplateData() {
	/** @type {TFLArrival[]} */
	const journeys = this.result || [];
	 /** @type {TFLArrival[]} */
	 const filteredJourneys = journeys
	 .filter((journey) => {
		const now = new Date();
		const expectedArrival = new Date(journey.expectedArrival);
		const timeToLive = new Date(journey.timeToLive);

		// Only filter out:
		// 1. Past arrivals
		// 2. Expired predictions (timeToLive in the past)
		return expectedArrival >= now && timeToLive >= now;
	  })
	 .sort((a, b) => new Date(a.expectedArrival).getTime() - new Date(b.expectedArrival).getTime())
	 .slice(0, this.config.limit)

    return {
		line: this.config.title,
		journeys: filteredJourneys,
		loaded: this.loaded,
      	activeMessage: this.activeMessage,
		tubeStatus: this.tubeStatus,
		tubeStatusDescription: this.tubeStatusDescription,
		statusMessages: this.combinedMessages,
    };
  },

  addFilters() {
    this.nunjucksEnvironment().addFilter("formatTime", (time) => {
      return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });

	this.nunjucksEnvironment().addFilter("capitalize", (string) => {
		return string.charAt(0).toUpperCase() + string.slice(1);
	});

	this.nunjucksEnvironment().addFilter("getMinutesToDate", (string) => {
		const arrivalTime = new Date(string);
		const now = new Date();
		const diff = arrivalTime.getTime() - now.getTime();
		const minutes = Math.floor(diff / 1000 / 60);

		if (minutes <= 1) {
			const seconds = Math.floor(diff / 1000);
			if (seconds <= 30) {
			return "Due";
			} else {
			return "1 min";
			}
		}
		if (minutes < 60) {
			return `in ${minutes} mins`;
		}
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours} hr ${mins} min`;
	});

	this.nunjucksEnvironment().addFilter("truncateAtSentence", (text, maxLength = 200) => {
		if (!text || text.length <= maxLength) {
			return text;
		}

		// Find the first period after a minimum length (to avoid truncating too early)
		const minLength = Math.min(100, maxLength / 2);
		const searchStart = Math.max(minLength, 0);
		const firstPeriodIndex = text.indexOf('.', searchStart);

		if (firstPeriodIndex !== -1 && firstPeriodIndex <= maxLength) {
			return text.substring(0, firstPeriodIndex + 1) + '...';
		}

		// If no period found within limit, truncate at maxLength
		return text.substring(0, maxLength) + '...';
	});

	this.nunjucksEnvironment().addFilter("removeStationSuffix", (string) => {
		if (!string) return string;
		return string.replace(/(Rail Station|Underground Station)/g, "").trim();
	});

  },

  /**
   * @param {string} notification
   * @param {TubeTimesPayload|TubeLineStatusPayload} payload
   */
  socketNotificationReceived(notification, payload) {
    // check to see if the response was for us and used the same url
    if (notification === "GOT-TUBE-TIMES" && "url" in payload && payload.url === this.url) {
      // we got some data so set the flag, stash the data to display then request the dom update
      this.loaded = true;
      this.result = payload.result;
	  if(this.activeMessage + 1 >= this.combinedMessages.length) {
		this.activeMessage = 0;
	 } else {
		this.activeMessage++;
	 }
      this.updateDom(0);
    }

    if (notification === "GOT-TUBE-LINE-STATUS" && "serviceURL" in payload && payload.serviceURL === this.serviceURL) {
      this.tubeStatus = payload.tubeStatus;
      this.tubeStatusDescription = payload.tubeStatusDescription;
      this.combinedMessages = payload.combinedMessages;
      this.updateDom(1000);
    }
  },
});
