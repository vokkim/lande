from pynobo import nobo
from flask import Flask, abort, request
import os
app = Flask(__name__)

MAX_TEMPERATURE = 32
MIN_TEMPERATURE = 2

hub = nobo(os.environ['NOBO_ID'])

@app.route('/')
def root():
  return hub.zones

@app.route('/<zoneId>')
def root(zoneId):
  return {
    "comfortTemperature": int(hub.zones[zoneId]['temp_comfort_c']),
    "ecoTemperature": int(hub.zones[zoneId]['temp_eco_c']),
    "mode": hub.get_current_zone_mode(zoneId)
  }

@app.route('/update', methods=['POST'])
def update():
    content = request.json
    zoneId = content['zoneId']
    comfortTemperature = int(content['comfortTemperature'])
    ecoTemperature = int(content['ecoTemperature'])
    mode = content['mode']

    if comfortTemperature < MIN_TEMPERATURE or comfortTemperature > MAX_TEMPERATURE:
      return abort(400)

    if ecoTemperature < MIN_TEMPERATURE or comfortTemperature > MAX_TEMPERATURE:
      return abort(400)

    if mode not in ['eco', 'comfort']:
      return abort(400)

    app.logger.info(f'Set mode {mode}, comfortTemperature={comfortTemperature} ecoTemperature={ecoTemperature}')

    hub.update_zone(zoneId, temp_comfort_c=comfortTemperature, temp_eco_c=ecoTemperature)
    if mode == 'comfort':
      hub.create_override(hub.API.OVERRIDE_MODE_COMFORT, hub.API.OVERRIDE_TYPE_CONSTANT, hub.API.OVERRIDE_TARGET_ZONE, zoneId)
    else:
      hub.create_override(hub.API.OVERRIDE_MODE_ECO, hub.API.OVERRIDE_TYPE_CONSTANT, hub.API.OVERRIDE_TARGET_ZONE, zoneId)
    return '', 204
