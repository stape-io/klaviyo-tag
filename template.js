const sendHttpRequest = require('sendHttpRequest');
const getAllEventData = require('getAllEventData');
const makeInteger = require('makeInteger');
const makeString = require('makeString');
const getTimestampMillis = require('getTimestampMillis');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');
const toBase64 = require('toBase64');
const getRemoteAddress = require('getRemoteAddress');
const getCookieValues = require('getCookieValues');
const setCookie = require('setCookie');
const decodeUriComponent = require('decodeUriComponent');
const getContainerVersion = require('getContainerVersion');
const logToConsole = require('logToConsole');
const getRequestHeader = require('getRequestHeader');

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;

const allEventData = getAllEventData();

if (data.type === 'addToList') {
  addToList();
} else {
  sendEvent();
}

function sendEvent() {
  let klaviyoEventData = {
    token: data.token,
    event: data.event,
    customer_properties: getCustomerProperties(),
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

  let url = 'https://a.klaviyo.com/api/track?data=' + enc(toBase64(JSON.stringify(klaviyoEventData)));

  if (isLoggingEnabled) {
    logToConsole(JSON.stringify({
      'Name': 'Klaviyo',
      'Type': 'Request',
      'TraceId': traceId,
      'EventName': klaviyoEventData.event,
      'RequestMethod': 'GET',
      'RequestUrl': url,
    }));
  }

  sendHttpRequest(url, (statusCode, headers, body) => {
    logToConsole(JSON.stringify({
      'Name': 'Klaviyo',
      'Type': 'Response',
      'TraceId': traceId,
      'EventName': klaviyoEventData.event,
      'ResponseStatusCode': statusCode,
      'ResponseHeaders': headers,
      'ResponseBody': body,
    }));

    if (statusCode >= 200 && statusCode < 300) {
      if (klaviyoEventData.event === 'Viewed Product') {
        sendViewedItems(klaviyoEventData);
      } else {
        data.gtmOnSuccess();
      }
    } else {
      data.gtmOnFailure();
    }
  }, {headers: {'X-Forwarded-For': getRemoteAddress()}, method: 'GET'});
}

function getCustomerProperties() {
  let email = data.email;
  if (email) {
    if (data.storeEmail) {
      storeCookie('email', email);
    }

    return {'$email': email};
  }

  let url = allEventData.page_location;
  if (url && url.indexOf('_kx=') !== -1) {
    let kx = url.split('_kx=')[1].split('&')[0];

    if (kx) {
      kx = decodeUriComponent(kx);
      storeCookie('kx', kx);

      return {'$exchange_id': kx};
    }
  }

  let kxCookie = getCookieValues('stape_klaviyo_kx');
  if (kxCookie.length) {
    return {'$exchange_id': kxCookie[0]};
  }

  let emailCookie = getCookieValues('stape_klaviyo_email');
  if (emailCookie.length) {
    return {'$email': emailCookie[0]};
  }

  return {};
}

function storeCookie(name, value) {
  setCookie('stape_klaviyo_'+name, value, {
    domain: 'auto',
    path: '/',
    samesite: 'Lax',
    secure: true,
    'max-age': 63072000, // 2 years
    httpOnly: false
  });
}

function sendViewedItems(klaviyoEventData) {
  let klaviyoProductsEventData = {
    token: data.token,
    time: makeInteger(getTimestampMillis()/1000),
    customer_properties: klaviyoEventData.customer_properties,
    properties: {
      '$viewed_items': getViewedItems(),
    }
  };

  if (klaviyoEventData.customer_properties['$email']) {
    klaviyoProductsEventData.properties['$email'] = klaviyoEventData.customer_properties['$email'];
  }

  if (klaviyoProductsEventData.properties['$email'] && klaviyoProductsEventData.properties['$viewed_items'] && klaviyoProductsEventData.properties['$viewed_items'].length) {
    let url = 'https://a.klaviyo.com/api/onsite/identify?c='+enc(data.token);

    if (isLoggingEnabled) {
      logToConsole(JSON.stringify({
        'Name': 'Klaviyo',
        'Type': 'Request',
        'TraceId': traceId,
        'EventName': 'viewed_items',
        'RequestMethod': 'POST',
        'RequestUrl': url,
        'RequestBody': klaviyoProductsEventData,
      }));
    }

    sendHttpRequest(url, (statusCode, headers, body) => {
      logToConsole(JSON.stringify({
        'Name': 'Klaviyo',
        'Type': 'Response',
        'TraceId': traceId,
        'EventName': klaviyoEventData.event,
        'ResponseStatusCode': statusCode,
        'ResponseHeaders': headers,
        'ResponseBody': body,
      }));

      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    }, {headers: {'X-Forwarded-For': getRemoteAddress(), 'Content-Type': 'application/json'}, method: 'POST'}, JSON.stringify(klaviyoProductsEventData));
  } else {
    data.gtmOnSuccess();
  }
}

function getViewedItems() {
  let viewedItems = [];
  let viewedItemsCookie = getCookieValues('stape_klaviyo_viewed_items');

  if (viewedItemsCookie.length && viewedItemsCookie[0]) {
    viewedItems = JSON.parse(viewedItemsCookie[0]);
  }

  if (allEventData.ItemId && allEventData.Title) {
    viewedItems = updateViewedItems(viewedItems);
  }

  if (viewedItems.length) {
    viewedItems = viewedItems.slice(-5);

    storeCookie('viewed_items', JSON.stringify(viewedItems));
  }

  return viewedItems;
}

function updateViewedItems(viewedItems) {
  for (let key in viewedItems) {
    if (viewedItems[key].ItemId && makeString(viewedItems[key].ItemId) === allEventData.ItemId) {
      viewedItems[key].Views = makeInteger(viewedItems[key].Views) + 1;

      return viewedItems;
    }
  }

  viewedItems.push({
    'Title': allEventData.Title,
    'ItemId': allEventData.ItemId,
    'Categories': allEventData.Categories || [allEventData.category],
    'ImageUrl': allEventData.ImageUrl,
    'Url': allEventData.Url || allEventData.page_location,
    'Metadata': {
      'Brand': allEventData.Brand || allEventData.brand,
      'Price': allEventData.Price || allEventData.price,
      'CompareAtPrice': allEventData.CompareAtPrice,
    },
    'Views': 1,
    'LastViewedDate': makeInteger(getTimestampMillis()/1000),
  });

  return viewedItems;
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
      containerVersion &&
      (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function addToList() {
  let url = 'https://a.klaviyo.com/api/v2/list/'+enc(data.listId)+'/subscribe?api_key='+enc(data.apiKey);
  let addToListData = {
    'profiles': [{
      'email': data.email,
    }]
  };

  if (isLoggingEnabled) {
    logToConsole(JSON.stringify({
      'Name': 'Klaviyo',
      'Type': 'Request',
      'TraceId': traceId,
      'EventName': 'add_to_list',
      'RequestMethod': 'POST',
      'RequestUrl': url,
      'RequestBody': addToListData,
    }));
  }

  sendHttpRequest(url, (statusCode, headers, body) => {
    logToConsole(JSON.stringify({
      'Name': 'Klaviyo',
      'Type': 'Response',
      'TraceId': traceId,
      'EventName': 'add_to_list',
      'ResponseStatusCode': statusCode,
      'ResponseHeaders': headers,
      'ResponseBody': body,
    }));

    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {headers: {'X-Forwarded-For': getRemoteAddress(), 'Content-Type': 'application/json'}, method: 'POST'}, JSON.stringify(addToListData));
}

function enc(data) {
  data = data || '';
  return encodeUriComponent(data);
}
