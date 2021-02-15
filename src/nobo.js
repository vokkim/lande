const axios = require('axios')
const config = require('./config')

async function getNoboStatus(zoneId) {
  if (config.mockNobo) {
    return Promise.resolve({comfortTemperature: 21, ecoTemperature: 15, mode: 'eco'})
  }
  const {data} = await axios.get(`http://localhost:5000/${zoneId}`)
  return Promise.resolve(data)
}

async function updateDevice(zoneId, comfortTemperature, ecoTemperature, mode) {
  if (config.mockNobo) {
    return Promise.resolve()
  }
  const body = {
    zoneId,
    comfortTemperature,
    ecoTemperature,
    mode: mode === 'away' ? 'eco' : 'comfort'
  }
  const {data} = await axios.post(`http://localhost:5000/update`, body)
  return Promise.resolve()
}

module.exports = {
  getNoboStatus,
  updateDevice
}