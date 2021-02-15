const axios = require('axios')
const _ = require('lodash')

const operationModeToString = {
  0: 'OFF',
  1: 'HEAT',
  2: 'DRY',
  3: 'COOL',
  7: 'FAN',
  8: 'AUTO'
}

const operationStringToMode = _.invert(operationModeToString)

function headers(token) {
  return {headers: {"X-MitsContextKey": token}}
}

async function listDevices(token) {
  const {data: buildings} = await axios.get('https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices', headers(token))
  return buildings.map(b => {
    return b.Structure.Devices.map(d => ({
      buildingId: b.ID,
      buildingName: b.Name,
      deviceId: d.DeviceID,
      deviceName: d.DeviceName,
      address: [b.AddressLine1, b.AddressLine2, b.Postcode, b.City].join('\n'),
      longitude: b.Longitude,
      latitude: b.Latitude,
    }))
  }).flat()
}

async function getDeviceStatus(token, {deviceId, buildingId}) {
  const {data} = await axios.get(`https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${deviceId}&buildingID=${buildingId}`, headers(token))

  return {
    online: data.Offline === false,
    powerOn: data.Power,
    currentTemperature: data.RoomTemperature,
    targetTemperature: data.SetTemperature,
    fanSpeed: data.SetFanSpeed,
    maxFanSpeed: data.NumberOfFanSpeeds,
    mode: operationModeToString[data.OperationMode],
    horizontal: data.vaneHorizontal,
    vertical: data.vaneVertical
  }
}

async function updateDevice(token, data) {
  const {deviceId, buildingId} = data
  const deviceStatus = await getDeviceStatus(token, {deviceId, buildingId})
  if (!deviceStatus.online) {
    throw new Error(`Can not set device ${deviceId} state, device offline!`)
  }
  const {mode, powerOn, targetTemperature, fanSpeed, vertical, horizontal, maxFanSpeed} = _.defaults(data, deviceStatus)
  const operationModeValue = operationStringToMode[mode]
  if (!operationModeValue) {
    throw new Error(`Unknown operation mode ${mode}`)
  }
  const body = {
    DeviceID: deviceId,
    EffectiveFlags : 0x1F,
    HasPendingCommand : 'true',
    Power: powerOn,
    SetTemperature: targetTemperature,
    OperationMode: operationStringToMode[mode],
    SetFanSpeed: Math.max(1, Math.min(fanSpeed, maxFanSpeed)),
    VaneVertical: vertical,
    VaneHorizontal: horizontal,
  }
  const response = await axios.post('https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta', body, headers(token))
  return {
    success: response.data.ErrorCode === 8000,
    effectiveFrom: new Date(response.data.NextCommunication + 'Z')
  }
}


async function MelCloudApi({email, password}) {
  const loginResponse = await axios.post(
    'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
    {
      'AppVersion': '1.9.3.0',
      'CaptchaChallenge': '',
      'CaptchaResponse': '',
      'Email': email,
      'Language': '0',
      'Password': password,
      'Persist': 'true'
    }
  )

  if (loginResponse.data.ErrorId === 1 ) {
    throw new Error(`MELCloud login failed, invalid username or password`)
  } else if (loginResponse.data.ErrorId !== null) {
    throw new Error(`MELCloud login failed, ErrorId ${loginResponse.data.ErrorId}`)
  }

  if (!loginResponse.data.LoginData || !loginResponse.data.LoginData.ContextKey) {
    throw new Error(`MELCloud login token not present`)
  }

  const token = loginResponse.data.LoginData.ContextKey

  return {
    listDevices: () => listDevices(token),
    getDeviceStatus: (device) => getDeviceStatus(token, device),
    updateDevice: (data) => updateDevice(token, data)
  }
}

module.exports = MelCloudApi
