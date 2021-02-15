const fs = require('fs')
const path = require('path')

const initialConfigurationPath = path.join(__dirname, '../configuration.json')
const currentConfigurationPath = path.join(__dirname, '../_temp-configuration.json')

function getConfiguration() {
  try {
    return JSON.parse(fs.readFileSync(currentConfigurationPath))
  } catch(e) {
    console.log(`Reading initial configuration from ${initialConfigurationPath}`)
    return JSON.parse(fs.readFileSync(initialConfigurationPath))
  }
}

const configurationJson = getConfiguration()

const melCloud = {
  email: process.env['MEL_EMAIL'],
  password: process.env['MEL_PASSWORD']
}

const host = process.env['INFLUX_HOST']
const influx = {
  username: process.env['INFLUX_USER'],
  password: process.env['INFLUX_PASS'],
  database: process.env['INFLUX_DB'],
  host: host.replace('http://', '').replace('https://').replace(/\:\d*/, ''),
  port: parseInt(host.replace(/.*\:/, ''))
}

const mockNobo = process.env['MOCK_NOBO'] === 'true' || false

function persistConfiguration(configuration) {
  return fs.promises.writeFile(currentConfigurationPath, JSON.stringify(configuration, null, 2))
}

module.exports = {
  mockNobo,
  melCloud,
  host,
  influx,
  initialConfiguration: configurationJson,
  persistConfiguration
}