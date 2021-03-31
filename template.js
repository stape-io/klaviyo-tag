const sendHttpRequest = require('sendHttpRequest');
const getAllEventData = require('getAllEventData');
const makeInteger = require('makeInteger');
const getTimestampMillis = require('getTimestampMillis');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');
const toBase64 = require('toBase64');
const getRemoteAddress = require('getRemoteAddress');

const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;

const allEventData = getAllEventData();

let klaviyoEventData = {
  token: data.token,
  event: data.event,
  customer_properties: {
    '$email': data.email,
  },
  properties: {},
  time: makeInteger(getTimestampMillis()/1000)
};

if (data.type === 'active_on_site') {
  klaviyoEventData.event = '__activity__';
  klaviyoEventData.properties['$is_session_activity'] = true;
  klaviyoEventData.properties['$use_ip'] = true;
}

if (allEventData.page_referrer) {
  klaviyoEventData.customer_properties['$last_referrer'] = {
    "ts": klaviyoEventData.time,
    "value": "",
    "first_page": allEventData.page_referrer
  };
}

if (allEventData.page_location) {
  klaviyoEventData.properties.page = allEventData.page_location;
}

if (data.customer_properties) {
  for (let key in data.customer_properties) {
    klaviyoEventData.customer_properties[data.customer_properties[key].name] = data.customer_properties[key].value;
  }
}

if (data.properties) {
  for (let key in data.properties) {
    klaviyoEventData.properties[data.properties[key].name] = data.properties[key].value;
  }
}

if (isDebug) {
  logToConsole('Klaviyo event data: ', klaviyoEventData);
}

let url = 'https://a.klaviyo.com/api/track?data=' + encodeUriComponent(toBase64(JSON.stringify(klaviyoEventData)));

sendHttpRequest(url, (statusCode, headers, body) => {
  if (statusCode >= 200 && statusCode < 300) {
    data.gtmOnSuccess();
  } else {
    data.gtmOnFailure();
  }
}, {headers: {'X-Forwarded-For': getRemoteAddress()}, method: 'GET', timeout: 3500});
