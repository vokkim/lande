const sparkline = require('node-sparkline')

const hvacModeToString = {
  'OFF': 'Kiinni',
  'HEAT': 'Lämmitys',
  'DRY': 'Kuivatus',
  'COOL': 'Jäähdytys',
  'FAN': 'Tuuletus',
  'AUTO': 'Auto'
}

const zoneStatusToString = {
  'home': 'Kotona',
  'away': 'Poissa'
}

function inverseZoneStatus(status) {
  return status === 'home' ? 'away' : 'home'
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
  <title>Tuomola</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #000000;
      color: #AAAAAA;
      font-family: 'Poppins';
      font-weight: 400;
      font-size: 16px;
      margin: 2rem;
    }
    .block {
      background: #1d1d1d;
      margin: 5px;
    }
    #sensors {
      display: flex;
    }
    .temperature {
      display: block;
      height: 90px;
      min-width: 90px;
      max-width: 110px;
      text-align: center;
      padding: 20px 5px;
    }
    .title {
      margin: 0px;
      font-size: 14px;
    }
    .value {
      margin: 5px;
      text-align: center;
      font-size: 20px;
      color: #FAFAFA;
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
      align-items: center;
    }

    .button {
      background: #525252;
      text-decoration: none;
      border: 0;
      height: 4rem;
      padding: 1rem 2rem;
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
      padding: 0;
      font-size: 3rem;
    }
    .zone-status {
      margin-right: 3rem;
    }
    .button.zone-status.home {
      background: #3e8c04;
    }
    .button.zone-status.away {
      background: #048c86;
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
      max-width: 18rem;
      margin-left: 11rem;
    }
    .device-type {
      flex: 1 1 auto;
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
      flex: 0 0 6rem;
      text-align: center;
    }

  </style>

</head>

<body>
  <h2>Lämpötilat</h2>
  <div id="sensors">
    ${status.sensorsValues.map(d => {
      const {label, current, history, min, max} = d
      const svg = sparkline({
        values: history,
        width: 110,
        height: 30,
        stroke: '#57bd0f',
        strokeWidth: 1.25,
        strokeOpacity: 1,
      })
      return `
        <div class="temperature block">
          <div class="title">${label}</div>
          <div class="value">${current ? current.toFixed(2) : 'N/A'}°C</div>
          ${svg}
        </div>`
    }).join('\n')}
  </div>
  <div id="zones">
    ${status.zones.map(zone => {
      return `
      <div class="zone">
        <h2>${zone.id}</h2>
        <div class="zone-controls">
          <form action="/zone/${zone.id}/status/${inverseZoneStatus(zone.status)}" method="post">
            <button class="button zone-status ${zone.status}">${zoneStatusToString[zone.status]}</button>
          </form>
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
      <div class="device-type">${device.type}</div>
      <div class="device-mode">${mode}</div>
      <div class="device-target">${device.targetTemperature}°C</div>
    </div>
  `
}

module.exports = render