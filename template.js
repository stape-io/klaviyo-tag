const sendHttpRequest = require('sendHttpRequest');
const getAllEventData = require('getAllEventData');
const makeInteger = require('makeInteger');
const makeString = require('makeString');
const getTimestampMillis = require('getTimestampMillis');
const JSON = require('JSON');
const getRemoteAddress = require('getRemoteAddress');
const getCookieValues = require('getCookieValues');
const setCookie = require('setCookie');
const decodeUriComponent = require('decodeUriComponent');
const getContainerVersion = require('getContainerVersion');
const logToConsole = require('logToConsole');
const getRequestHeader = require('getRequestHeader');

const eventPropertiesToIgnore = [
  'x-ga-protocol_version',
  'x-ga-measurement_id',
  'x-ga-gtm_version',
  'x-ga-page_id',
  'x-ga-system_properties',
  'client_id',
  'language',
  'x-ga-request_count',
  'ga_session_id',
  'ga_session_number',
  'x-ga-mp2-seg',
  'page_location',
  'page_referrer',
  'page_title',
  'ip_override',
  'user_agent',
  'x-ga-js_client_id',
  'screen_resolution',
  'x-ga-mp2-user_properties',
];

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;

const eventData = getAllEventData();
const klaviyoApiRevision = '2023-07-15';

if (data.type === 'addToList') {
  addToList();
} else {
  sendEvent();
}

function sendEvent() {
  let eventName = data.type === 'active_on_site' ? '__activity__' : data.event;
  let eventNameLogs = data.type === 'active_on_site' ? 'page_view' : data.event;

  let klaviyoEventData = {
    'data': {
      'type': 'event',
      'attributes': {
        'properties': {},
        'metric': {
          'data': {
            'type': 'metric',
            'attributes': {
              'name': eventName
            }
          }
        },
        'profile': {
          'data': {
            'type': 'profile',
            'attributes': {}
          }
        }
      }
    }
  };

  if (data.value) klaviyoEventData.data.attributes.value = data.value;
  else if (eventData.value) klaviyoEventData.data.attributes.value = data.value;

  if (data.uniqueId) klaviyoEventData.data.attributes.unique_id = data.uniqueId;
  else if (eventData.unique_id) klaviyoEventData.data.attributes.unique_id = data.unique_id;

  klaviyoEventData.data.attributes.properties = getProperties();
  addViewedItemsIfNeeded(eventName, klaviyoEventData);

  klaviyoEventData.data.attributes.profile.data.attributes = getCustomerProperties();
  if (data.klaviyoUserId) klaviyoEventData.data.attributes.profile.data.id = data.klaviyoUserId;

  let url = 'https://a.klaviyo.com/api/events/';

  if (isLoggingEnabled) {
    logToConsole(
        JSON.stringify({
          Name: 'Klaviyo',
          Type: 'Request',
          TraceId: traceId,
          EventName: eventNameLogs,
          RequestMethod: 'POST',
          RequestUrl: url,
          RequestBody: klaviyoEventData,
        })
    );
  }

  sendHttpRequest(
      url,
      (statusCode, headers, body) => {
        logToConsole(
            JSON.stringify({
              Name: 'Klaviyo',
              Type: 'Response',
              TraceId: traceId,
              EventName: eventNameLogs,
              ResponseStatusCode: statusCode,
              ResponseHeaders: headers,
              ResponseBody: body,
            })
        );

        if (!data.useOptimisticScenario) {
          if (statusCode >= 200 && statusCode < 300) {
            data.gtmOnSuccess();
          } else {
            data.gtmOnFailure();
          }
        }
      },
      {
        headers: {
          'X-Forwarded-For': getRemoteAddress(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Revision': klaviyoApiRevision,
          'Authorization': 'Klaviyo-API-Key ' + data.apiKey,
        },
        method: 'POST'
      },
      JSON.stringify(klaviyoEventData)
  );

  if (data.useOptimisticScenario) {
    data.gtmOnSuccess();
  }
}

function getProperties() {
  let klaviyoProperties = {};

  if (data.forwardAllProperties) {
    let excludeKeys = [];
    if (data.excludeForwardingProperties) excludeKeys = data.excludeForwardingProperties.map((n) => n.name);

    for (let key in eventData) {
      const shouldIgnore = hasItem(eventPropertiesToIgnore, key);
      const shouldExclude = hasItem(excludeKeys, key);

      if (!shouldIgnore && !shouldExclude) {
        klaviyoProperties[key] = eventData[key];
      }
    }
  }

  if (eventData.page_location) {
    klaviyoProperties.page = eventData.page_location;
  }

  if (data.properties) {
    for (let key in data.properties) {
      klaviyoProperties[data.properties[key].name] = data.properties[key].value;
    }
  }

  return klaviyoProperties;
}

function getCustomerProperties() {
  let customerProperties = {
    'properties': {},
  };

  if (data.email) customerProperties.email = data.email;
  else if (eventData.email) customerProperties.email = eventData.email;
  else {
    let emailCookie = getCookieValues('stape_klaviyo_email');
    if (emailCookie.length) customerProperties.email = emailCookie[0];
  }

  let url = eventData.page_location;
  if (url && url.indexOf('_kx=') !== -1) {
    let kx = url.split('_kx=')[1].split('&')[0];
    if (kx) customerProperties['_kx'] = decodeUriComponent(kx);
  } else {
    let kxCookie = getCookieValues('stape_klaviyo_kx');
    if (kxCookie.length) customerProperties['_kx'] = kxCookie[0];
  }

  if (eventData.page_referrer) customerProperties.properties['$last_referrer'] = eventData.page_referrer;

  if (data.customerStandardProperties) {
    for (let key in data.customerStandardProperties) {
      customerProperties[data.customerStandardProperties[key].name] = data.customerStandardProperties[key].value;
    }
  }

  if (data.customerLocationProperties) {
    customerProperties.location = {};

    for (let key in data.customerLocationProperties) {
      customerProperties.location[data.customerLocationProperties[key].name] = data.customerLocationProperties[key].value;
    }
  }

  if (data.customerProperties) {
    for (let key in data.customerProperties) {
      customerProperties.properties[data.customerProperties[key].name] = data.customerProperties[key].value;
    }
  }

  if (customerProperties.email) {
    storeCookie('email', customerProperties.email);
  }

  if (customerProperties['_kx']) {
    storeCookie('kx', customerProperties['_kx']);
  }

  return customerProperties;
}

function storeCookie(name, value) {
  setCookie('stape_klaviyo_' + name, value, {
    domain: 'auto',
    path: '/',
    samesite: 'Lax',
    secure: true,
    'max-age': 63072000, // 2 years
    httpOnly: false,
  });
}

function getViewedItems() {
  let viewedItems = [];
  let viewedItemsCookie = getCookieValues('stape_klaviyo_viewed_items');

  if (viewedItemsCookie.length && viewedItemsCookie[0]) {
    viewedItems = JSON.parse(viewedItemsCookie[0]);
  }

  if (eventData.ItemId && eventData.Title) {
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
    if (
        viewedItems[key].ItemId &&
        makeString(viewedItems[key].ItemId) === eventData.ItemId
    ) {
      viewedItems[key].Views = makeInteger(viewedItems[key].Views) + 1;

      return viewedItems;
    }
  }

  viewedItems.push({
    Title: eventData.Title,
    ItemId: eventData.ItemId,
    Categories: eventData.Categories || [eventData.category],
    ImageUrl: eventData.ImageUrl,
    Url: eventData.Url || eventData.page_location,
    Metadata: {
      Brand: eventData.Brand || eventData.brand,
      Price: eventData.Price || eventData.price,
      CompareAtPrice: eventData.CompareAtPrice,
    },
    Views: 1,
    LastViewedDate: makeInteger(getTimestampMillis() / 1000),
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
  let url = 'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/';

  let addToListData = {
    'data': {
      'type': 'profile-subscription-bulk-create-job',
      'attributes': {
        'profiles': {
          'data': [
            {
              'type': 'profile',
              'attributes': {
                'email': data.email
              }
            }
          ]
        }
      },
      'relationships': {
        'list': {
          'data': {
            'type': 'list',
            'id': data.listId
          }
        }
      }
    }
  };

  if (isLoggingEnabled) {
    logToConsole(
        JSON.stringify({
          Name: 'Klaviyo',
          Type: 'Request',
          TraceId: traceId,
          EventName: 'add_to_list',
          RequestMethod: 'POST',
          RequestUrl: url,
          RequestBody: addToListData,
        })
    );
  }

  sendHttpRequest(
      url,
      (statusCode, headers, body) => {
        logToConsole(
            JSON.stringify({
              Name: 'Klaviyo',
              Type: 'Response',
              TraceId: traceId,
              EventName: 'add_to_list',
              ResponseStatusCode: statusCode,
              ResponseHeaders: headers,
              ResponseBody: body,
            })
        );

        if (!data.useOptimisticScenario) {
          if (statusCode >= 200 && statusCode < 300) {
            data.gtmOnSuccess();
          } else {
            data.gtmOnFailure();
          }
        }
      },
      {
        headers: {
          'X-Forwarded-For': getRemoteAddress(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Revision': klaviyoApiRevision,
          'Authorization': 'Klaviyo-API-Key ' + data.apiKey,
        },
        method: 'POST',
      },
      JSON.stringify(addToListData)
  );

  if (data.useOptimisticScenario) {
    data.gtmOnSuccess();
  }
}

function hasItem(arr, item) {
  for (let k in arr) {
    if (arr[k] === item) return true;
  }

  return false;
}

function addViewedItemsIfNeeded(eventName, klaviyoEventData) {
  if (eventName === 'Viewed Product') {
    let viewedItems = getViewedItems();

    if (viewedItems.length > 0) {
      klaviyoEventData.data.attributes.properties['$viewed_items'] = getViewedItems();
    }
  }
}
