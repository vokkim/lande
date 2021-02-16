const express = require('express')
const axios = require('axios')
const Influx = require('influx')
const fs = require('fs/promises')
const MelCloudApi = require("./mel.js")
const indexTemplate = require('./index-template')
const config = require('./config')
const nobo = require('./nobo')

const app = express()
const port = 3000

let mel = null

const configuration = config.initialConfiguration

MelCloudApi(config.melCloud).then(api => mel = api)
const influx = new Influx.InfluxDB(config.influx)

app.get('/', async (req, res) => {
  const result = await getStatus()
  res.send(indexTemplate(result))
})

app.post('/zone/:id/status/:status', async(req, res) => {
  const zone = configuration.zones.find(z => z.id === req.params.id)
  if (!zone) {
    console.error(`Zone ${req.params.id} not found`)
    return res.sendStatus(400)
  }
  if (!['away', 'home'].includes(req.params.status)) {
    console.error(`Status ${req.params.status} invalid`)
    return res.sendStatus(400)
  }
  zone.status = req.params.status

  await setAllValues(configuration)
  res.redirect('/')
})

app.post('/zone/:id/temp/:temperature', async(req, res) => {
  const zone = configuration.zones.find(z => z.id === req.params.id)
  if (!zone) {
    console.error(`Zone ${req.params.id} not found`)
    return res.sendStatus(400)
  }
  const temperature = parseInt(req.params.temperature)
  if (!isFinite(temperature) || temperature <= 0 || temperature > 26) {
    console.error(`Temperature ${req.params.temperature} invalid`)
    return res.sendStatus(400)
  }
  zone[`${zone.status}Temperature`] = temperature

  await setAllValues(configuration)
  res.redirect('/')
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

async function getStatus() {
  if (!mel) {
    throw new Error(`MELCloud API not ready!`)
  }
  const sensorsValues = await getTemperatures()
  const zones = await Promise.all(configuration.zones.map(getZoneStatus))
  return {
    zones,
    sensorsValues
  }
}


function getExpectedZoneTemperature(zoneConfig) {
  if (zoneConfig.status === 'home') {
    return zoneConfig.homeTemperature
  } else {
    return zoneConfig.awayTemperature
  }
}

async function getZoneStatus(zoneConfig) {

  const devices = await Promise.all(zoneConfig.devices.map(async (device) => {
    const expectedTemperatureForDevice = getExpectedZoneTemperature(zoneConfig) + device.temperatureCorrection || 0
    if (device.type === 'melcloud') {
      const hvac = await mel.getDeviceStatus({
        buildingId: device.buildingId,
        deviceId: device.deviceId
      })
      const on = hvac.online && hvac.powerOn
      const {fanSpeed, mode, targetTemperature} = hvac
      const status = targetTemperature === expectedTemperatureForDevice ? zoneConfig.status : 'unknown'
      return {...device, status, on, fanSpeed, mode, targetTemperature}
    } else if (device.type === 'nobo') {
      const noboStatus = await nobo.getNoboStatus(device.zoneId)
      const targetTemperature = noboStatus[`${noboStatus.mode}Temperature`]
      const status = targetTemperature === expectedTemperatureForDevice ? zoneConfig.status : 'unknown'
      return {...device, status, mode: noboStatus.mode, targetTemperature}
    } else {
      throw new Error(`Unsupported device type ${device.type}`)
    }
  }))

  return {...zoneConfig, devices, targetTemperature: getExpectedZoneTemperature(zoneConfig)}
}

function getSensorLabelForName(value) {
  const o = configuration.sensorsValues.find(({name}) => name === value)
  return o ? o.label : null
}

async function getTemperatures() {
  const historyResult = await influx.query(`
    SELECT mean("temperature") as "temperature" FROM a_month.ruuvitag
    WHERE time > now() - 42h
    GROUP BY "name", time(1h) FILL(null)
    ORDER BY time ASC
  `)
  const currentResult = await influx.query(`
    SELECT temperature, "name"
      FROM a_month.ruuvitag
      WHERE time > now() - 5m
      GROUP BY "name" ORDER BY time
      DESC LIMIT 1
  `)
  return configuration.sensorsValues.map(sensor => {
    const currentValue = currentResult.find(v => v.name === sensor.name)
    const current = currentValue ? currentValue.temperature : null
    const history = historyResult
      .filter(v => v.name === sensor.name)
      .map(v => v.temperature)
    return {...sensor, current, history}
  })
}

async function setAllValues(configuration) {
  await Promise.all(configuration.zones.map(zone => {
    const targetTemperature = getExpectedZoneTemperature(zone)
    return Promise.all(zone.devices.map(device => {
      if (device.type === 'melcloud') {
        return mel.updateDevice({
          buildingId: device.buildingId,
          deviceId: device.deviceId,
          targetTemperature: targetTemperature + device.temperatureCorrection || 0
        })
      } else if (device.type === 'nobo') {
        return nobo.updateDevice(
          device.zoneId,
          zone.homeTemperature + device.temperatureCorrection || 0,
          zone.awayTemperature + device.temperatureCorrection || 0,
          zone.status
        )
      } else {
        throw new Error(`Unknown device type ${device.type}`)
      }
    }))
  }))

  await config.persistConfiguration(configuration)
}

process.on('unhandledRejection', error => {
  console.log('Error', error.message)
  process.exit(-1)
})
