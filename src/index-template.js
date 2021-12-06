const sparkline = require('node-sparkline')
const {STATUS} = require('./enums')

const hvacModeToString = {
  'OFF': 'Kiinni',
  'HEAT': 'Lämmitys',
  'DRY': 'Kuivatus',
  'COOL': 'Jäähdytys',
  'FAN': 'Tuuletus',
  'AUTO': 'Auto'
}

const zoneStatusToString = {
  [STATUS.WARM]: 'Lämmitys',
  [STATUS.COOL]: 'Jäähdytys',
  [STATUS.AWAY]: 'Poissa',
  [STATUS.OFF]: 'Kiinni'
}

function render(status) {
  return `
<!doctype html>

<html lang="en">
<head>
  <meta name="viewport" content="initial-scale=1, maximum-scale=1">
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
  <title>${status.title || ''}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html {
      font-size: 13px;
    }
    body {
      background: #000000;
      color: #AAAAAA;
      font-family: 'Poppins';
      font-weight: 400;
      font-size: 16px;
      margin: 2rem 1rem;
    }
    #sensors {
      display: flex;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .temperature {
      display: block;
      text-align: center;
      padding: 0 1rem 2rem 0;
      position: relative;
    }
    .temperature svg {
      background: #525252;
    }
    .temperatere .title {
      margin: 0px;
      font-size: 1.3rem;
    }
    .temperature .value {
      margin: 5px;
      text-align: center;
      font-size: 20px;
      color: #FAFAFA;
      position: absolute;
      left: 0;
      right: 0;
    }
    span.humidity {
      font-size: 14px;
      color: #58c8ea;
      display: block;
    }

    h2 {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 1.3rem;
      letter-spacing: 2px;
    }
    .zone {
      display: flex;
      flex-direction: column;
      margin: 2rem 0;
    }
    .zone-controls {
      display: flex;
      margin: 5px 0;
    }
    .zone-modes {
      display: flex;
      flex-direction: column;
    }
    .zone-modes form {
      display: block;
      margin: 5px 0;
    }

    .zone-right-buttons {
      display: flex;
    }

    .button {
      background: #525252;
      text-decoration: none;
      border: 0;
      height: 3.5rem;
      padding: 0.5rem 1.5rem;
      border-radius: 2rem;
      text-align: center;
      font-size: 1.5rem;
      color: #FFFFFF;
      cursor: pointer;
      transition: background 150ms;
      user-select: none;
    }
    .button:selected {
      outline: none;
    }
    .button:hover {
      background: #383838;
    }
    .zone-temp {
      width: 4rem;
      height: 4rem;
      padding: 0;
      font-size: 3rem;
    }
    .zone-status {
      margin-right: 3rem;
      opacity: 0.45;
    }
    .zone-status.active {
      opacity: 1;
    }
    .button.zone-status.home {
      background: #963144;
    }
    .button.zone-status.away {
      background: #048c86;
    }
    .button.zone-status.cool {
      background: #1b71bd;
    }
    .zone-target {
      font-size: 3rem;
      color: #FFFFFF;
      margin: 0 1rem;
      width: 7rem;
      text-align: right;
    }
    .device {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
    }
    .device-type {
      flex: 0 0 6rem;
    }

    .device-status {
      flex: 0 0 2rem;
    }
    .device-status:after {
      content: '';
      display: block;
      height: 1rem;
      width: 1rem;
      border-radius: 1rem;
    }
    .device-status.unknown:after {
      background: #ffff22;
    }
    .device-status.home:after {
      background: #3e8c04;
    }
    .device-status.away:after {
      background: #048c86;
    }

    .device-mode {
      flex: 0 0 10rem;
      text-align: center;
    }

  </style>

</head>

<body>
  <h2>Lämpötilat</h2>
  <div id="sensors">
    ${status.sensorsValues.map(d => {
      const {label, current, history, min, max, humidity} = d
      const temperatureLine = sparkline({
        values: history.map(h => h.temperature),
        width: 110,
        height: 110,
        stroke: '#57bd0f',
        strokeWidth: 2.5,
        strokeOpacity: 1,
        minValue: min || 0,
        maxValue: max || 30,
        outputOnlyLine: true
      })

      const humidityLine = sparkline({
        values: history.map(h => h.humidity),
        width: 110,
        height: 110,
        stroke: '#58c8ea',
        strokeWidth: 2,
        strokeOpacity: 1,
        minValue: 0,
        maxValue: 100,
        outputOnlyLine: true
      })

      const svg = `
        <svg width="110" height="110" viewBox="0 0 110 110" shape-rendering="auto">
          ${humidity && humidityLine}
          ${temperatureLine}
        </svg>`
      return `
        <div class="temperature block">
          <div class="title">${label}</div>
          <div class="value">
            <span>${current && current.temperature ? current.temperature.toFixed(1) : 'N/A'}°C</span>
            ${humidity ? `<span class="humidity">${current && current.humidity ? current.humidity.toFixed(0) : 'N/A'}%</span>` : ''}
          </div>
          ${svg}
        </div>`
    }).join('\n')}
  </div>
  <div id="zones">
    ${status.zones.map(zone => {

      const hasMelCloud = Boolean(zone.devices.find(d => d.type === 'melcloud'))
      const switches = hasMelCloud ? [STATUS.WARM, STATUS.COOL, STATUS.AWAY, STATUS.OFF] : [STATUS.WARM, STATUS.AWAY]

      return `
      <div class="zone">
        <h2>${zone.id}</h2>
        <div class="zone-controls">
          <div class="zone-modes">
          ${switches.map(status => `
            <form action="/zone/${zone.id}/status/${status}" method="post">
              <button class="button zone-status ${status} ${zone.status === status ? 'active' : ''}">${zoneStatusToString[status]}</button>
            </form>
          `).join('\n')}
          </div>
          <div class="zone-right">
            <div class="zone-right-buttons">
              <form action="/zone/${zone.id}/temp/${zone.targetTemperature-1}" method="post">
                <button class="button zone-temp">-</button>
              </form>
              <div class="zone-target">${zone.targetTemperature}°C</div>
              <form action="/zone/${zone.id}/temp/${zone.targetTemperature+1}" method="post">
                <button class="button zone-temp">+</button>
              </form>
            </div>
            <div class="devices">${zone.devices.map(renderDevice).join('\n')}</div>
          </div>
        </div>
      </div>
      `
    }).join('\n')}
  </div>
</body>
</html>
`
}

function renderDevice(device) {
  const mode = device.type === 'melcloud' ? hvacModeToString[device.mode] : device.mode
  return `
    <div class="device">
      <div class="device-status ${device.status}"></div>
      <div class="device-type">${device.name || device.type}</div>
      <div class="device-mode">${mode}</div>
      <div class="device-target">${device.targetTemperature}°C</div>
    </div>
  `
}

module.exports = render