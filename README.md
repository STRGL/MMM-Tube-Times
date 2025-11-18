# MMM-TubeTimes

## Magic Mirror Module for Transport for London Arrival Times

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror).

This module displays real-time arrival times for Transport for London (TFL) services at a specific stop, including:

* Tube
* Elizabeth Line
* DLR
* Overground

The module shows upcoming train arrivals with estimated times and displays line status information including service disruptions and planned works.

## Installation

Navigate into your MagicMirror's `modules` folder and execute:

```bash
git clone https://github.com/YOUR_USERNAME/MMM-TubeTimes.git
cd MMM-TubeTimes
npm install
```

The module requires `axios` as a dependency, which will be installed automatically via `npm install`.

## Configuration

The entry in `config.js` can include the following options. _All arguments are optional_.

| Option | Description |
|--------|-------------|
| `title` | Custom title to display in the module header. **Type:** string **Default value:** "Tube Times" |
| `lineId` | TFL line ID(s). Can be a single line (e.g., "central") or a comma-separated list (e.g., "central,piccadilly"). **Recommended:** Only include lines that actually stop at your `stopPointId` to avoid displaying irrelevant status information. **Type:** string **Default value:** "central" |
| `stopPointId` | TFL stop point ID (Naptan ID) for the station. Find your station's ID at [TFL API StopPoint search](https://api.tfl.gov.uk/swagger/ui/index.html?url=/swagger/docs/v1#!/StopPoint/StopPoint_Search). **Type:** string **Default value:** "940GZZLUOXC" |
| `direction` | Direction filter for arrivals. Options: "all", "inbound", or "outbound". **Type:** string **Default value:** "all" |
| `updateInterval` | How often the arrival times are updated (in milliseconds). **Type:** number **Default value:** 20000 (20 seconds) |
| `statusUpdateInterval` | How often the line status is updated (in milliseconds). **Type:** number **Default value:** 3600000 (1 hour) |
| `limit` | Maximum number of journeys to display. **Type:** number **Default value:** 8 |

### Finding Your Station ID

To find your station's `stopPointId`:

1. Visit the [TFL API StopPoint search](https://api.tfl.gov.uk/swagger/ui/index.html?url=/swagger/docs/v1#!/StopPoint/StopPoint_Search)
2. Search for your station name
3. Look for the `id` field in the response (it will be a string like "910GWDRYTON")
4. Alternatively, you can use the TFL website's station page URL - the stop point ID is often visible in the URL or page source

### Example Configuration

Here is an example of an entry in `config.js`:

```javascript
{
    module: 'MMM-TubeTimes',
    position: 'bottom_right',
    config: {
        title: 'OxfordCircus',
        lineId: 'central',
        stopPointId: '940GZZLUOXC',
        direction: 'inbound',
        updateInterval: 20 * 1000, // 20 seconds
        statusUpdateInterval: 60 * 60 * 1000, // 1 hour
        limit: 8
    }
}
```

**Example with multiple lines:**

If your station is served by multiple lines, you can specify them as a comma-separated list:

```javascript
{
    module: 'MMM-TubeTimes',
    position: 'bottom_right',
    config: {
        title: 'Oxford Circus',
        lineId: 'central,bakerloo,victoria', // Only include lines that stop at this station
        stopPointId: '940GZZLUOXC',
        direction: 'all',
        updateInterval: 20 * 1000,
        statusUpdateInterval: 60 * 60 * 1000,
        limit: 8
    }
}
```

**Note:** When using multiple lines, only include lines that actually stop at your specified `stopPointId`

## Features

* Real-time arrival predictions for TFL services
* Line status display with service disruption messages
* Automatic filtering of expired predictions
* Support for all TFL modes (Tube, Elizabeth Line, DLR, Overground)
* Direction filtering (inbound/outbound/all)
* Customizable update intervals
* Responsive design with status indicators

## TFL API

This module uses the [Transport for London Unified API](https://api.tfl.gov.uk/).

**Note:** This plugin does not require any API key because TFL grants 50 requests/minute under anonymous access at the time of writing.

For more information on the TFL API, check out their [official documentation](https://api.tfl.gov.uk/).

## Credits

This module is based on and inspired by [MMM-TFL-Status](https://github.com/emanuele-albini/MMM-TFL-Status) by Emanuele Albini.

This module extends the functionality by:
* Displaying real-time arrival times for specific stations
* Showing detailed journey information (destination, platform, estimated arrival)
* Providing line status with disruption messages
* Filtering arrivals by direction
* Automatically handling expired predictions

## License

MIT Licensed. See LICENSE file for details.

## Issues

If you encounter any issues with this module, please submit an issue on GitHub.

