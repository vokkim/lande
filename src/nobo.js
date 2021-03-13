const axios = require('axios')
const config = require('./config')
const {STATUS} = require('./enums')

async function getNoboStatus(zoneId) {
  if (config.mockNobo) {
    return Promise.resolve({comfortTemperature: 21, ecoTemperature: 15, mode: 'eco'})
  }
  const {data} = await axios.get(`http://localhost:5000/${zoneId}`)
  return Promise.resolve(data)
}

async function updateDevice(zoneId, comfortTemperature, ecoTemperature, status) {
  if (config.mockNobo) {
    return Promise.resolve()
  }
  if ([STATUS.OFF, STATUS.COOL].includes(status)) {
    const body = {
      zoneId,
      comfortTemperature,
      ecoTemperature: 5,
      mode: 'eco'
    }
    await axios.post(`http://localhost:5000/update`, body)
    return true
  }
  const body = {
    zoneId,
    comfortTemperature,
    ecoTemperature,
    mode: status === STATUS.AWAY ? 'eco' : 'comfort'
  }
  await axios.post(`http://localhost:5000/update`, body)
  return true
}

module.exports = {
  getNoboStatus,
  updateDevice
}