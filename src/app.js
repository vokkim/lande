const express = require('express')
const axios = require('axios')
const Influx = require('influx')
const fs = require('fs/promises')
const MelCloudApi = require("./mel.js")
const indexTemplate = require('./index-template')
const config = require('./config')
const nobo = require('./nobo')
const {STATUS} = require('./enums')

const app = express()
const port = 3000

let mel = null

const configuration = config.initialConfiguration

MelCloudApi(config.melCloud).then(api => {
  mel = api
  console.log('MELCloud API ok!')
})
const influx = new Influx.InfluxDB(config.influx)

app.get('/health', async (req, res) => {
  res.send('ok')
})

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Transfer-Encoding', 'chunked')
  res.write('')
  const result = await getStatus()
  res.write(indexTemplate(result))
  res.end()
})

app.post('/zone/:id/status/:status', async(req, res) => {
  const zone = configuration.zones.find(z => z.id === req.params.id)
  if (!zone) {
    console.error(`Zone ${req.params.id} not found`)
    return res.sendStatus(400)
  }
  if (![STATUS.AWAY, STATUS.WARM, STATUS.COOL, STATUS.OFF].includes(req.params.status)) {
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
    title: configuration.title,
    zones,
    sensorsValues
  }
}


function getExpectedZoneTemperature(zoneConfig) {
  const temp = zoneConfig[`${zoneConfig.status}Temperature`]
  if (temp === undefined) {
    if (zoneConfig.status === STATUS.COOL) {
      return 20
    }
    if (zoneConfig.status === STATUS.OFF) {
      return 5
    }
    return 10
  }
  return temp
}

async function getZoneStatus(zoneConfig) {

  const devices = await Promise.all(zoneConfig.devices.map(async (device) => {
    const expectedTemperatureForDevice = getExpectedZoneTemperature(zoneConfig) + (device.temperatureCorrection || 0)
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
      const correction = (device.temperatureCorrection || 0)
      if (device.type === 'melcloud') {
        return mel.updateDevice({
          buildingId: device.buildingId,
          deviceId: device.deviceId,
          targetTemperature: targetTemperature + correction,
          status: zone.status
        })
      } else if (device.type === 'nobo') {
        return nobo.updateDevice(
          device.zoneId,
          zone.homeTemperature + correction,
          zone.awayTemperature + correction,
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
