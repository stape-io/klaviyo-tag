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
const getType = require('getType');

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
  'x-ga-mp2-user_properties'
];

const actionTypes = {
  ADD_TO_LIST: 'addToList',
  EVENT: 'event',
  ACTIVE_ON_SITE: 'active_on_site',
  CREATE_OR_UPDATE_PROFILE: 'createOrUpdateProfile'
};
const klaviyoApiRevision = '2024-06-15';

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;

const eventData = getAllEventData();

switch (data.type) {
  case actionTypes.ADD_TO_LIST:
    addToList();
    break;
  case actionTypes.EVENT:
  case actionTypes.ACTIVE_ON_SITE:
    sendEvent();
    break;
  case actionTypes.CREATE_OR_UPDATE_PROFILE:
    createOrUpdateProfile();
    break;
}

if (data.useOptimisticScenario) {
  data.gtmOnSuccess();
}

function sendEvent() {
  const eventName = data.type === actionTypes.ACTIVE_ON_SITE ? '__activity__' : data.event;
  const eventNameLogs = data.type === actionTypes.ACTIVE_ON_SITE ? 'page_view' : data.event;

  const klaviyoEventData = getKlaviyoEventData(eventName);

  if (!hasUserIdentificationData(klaviyoEventData)) {
    return data.gtmOnSuccess();
  }
  
  const url = 'https://a.klaviyo.com/api/events/';

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Klaviyo',
        Type: 'Request',
        TraceId: traceId,
        EventName: eventNameLogs,
        RequestMethod: 'POST',
        RequestUrl: url,
        RequestBody: klaviyoEventData
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
          ResponseBody: body
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
      headers: buildRequestHeaders(),
      method: 'POST'
    },
    JSON.stringify(klaviyoEventData)
  );
}

function addToList() {
  const url = 'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/';

  const addToListData = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        profiles: {
          data: [
            {
              type: 'profile',
              attributes: {
                email: data.email
              }
            }
          ]
        }
      },
      relationships: {
        list: {
          data: {
            type: 'list',
            id: data.listId
          }
        }
      }
    }
  };
  
  const subscriptions = {};
  if (data.subscribeToMarketingEmails) {
    subscriptions.email = {
      marketing: {
        consent: 'SUBSCRIBED'
      }
    };
  }
  if (data.subscribeToMarketingSMS) {
    subscriptions.sms = {
      marketing: {
        consent: 'SUBSCRIBED'
      }
    };
    let phone = '';
    if (data.phone) {
      phone = data.phone;
    }
    addToListData.data.attributes.profiles.data[0].attributes.phone_number = phone;
  }
  addToListData.data.attributes.profiles.data[0].attributes.subscriptions = subscriptions;

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Klaviyo',
        Type: 'Request',
        TraceId: traceId,
        EventName: 'add_to_list',
        RequestMethod: 'POST',
        RequestUrl: url,
        RequestBody: addToListData
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
          ResponseBody: body
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
      headers: buildRequestHeaders(),
      method: 'POST'
    },
    JSON.stringify(addToListData)
  );
}

function createOrUpdateProfile() {
  const url = 'https://a.klaviyo.com/api/profile-import/';
  
  const updateProfileData = {
    data: getProfileData()
  };
  
  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Klaviyo',
        Type: 'Request',
        TraceId: traceId,
        EventName: 'createOrUpdateProfile',
        RequestMethod: 'POST',
        RequestUrl: url,
        RequestBody: updateProfileData
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
          EventName: 'createOrUpdateProfile',
          ResponseStatusCode: statusCode,
          ResponseHeaders: headers,
          ResponseBody: body
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
      headers: buildRequestHeaders(),
      method: 'POST'
    },
    JSON.stringify(updateProfileData)
  );
}

function getKlaviyoEventData(eventName) {
  return {
    data: {
      type: 'event',
      attributes: getAttributes(eventName)
    }
  };
}

function getAttributes(eventName) {
  const attributes = {
    properties: getProperties(eventName),
    metric: {
      data: {
        type: 'metric',
        attributes: {
          name: eventName
        }
      }
    },
    profile: {
      data: getProfileData()
    }
  };

  const uniqueId = data.uniqueId || eventData.unique_id;
  if (uniqueId) attributes.unique_id = uniqueId;

  const value = data.value || eventData.value;
  if (value) attributes.value = value;

  return attributes;
}

function getProfileData() {
  const profileData = {
    type: 'profile',
    attributes: getCustomerProperties()
  };
  if (data.klaviyoUserId) profileData.id = data.klaviyoUserId;

  return profileData;
}

function getProperties(eventName) {
  const klaviyoProperties = {};

  if (data.forwardAllProperties) {
    let excludeKeys = [];
    if (data.excludeForwardingProperties)
      excludeKeys = data.excludeForwardingProperties.map((n) => n.name);

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

  if (data.type === actionTypes.ACTIVE_ON_SITE) {
    klaviyoProperties['$is_session_activity'] = 'true';
    klaviyoProperties['$use_ip'] = 'true';
  }

  if (data.properties) {
    for (let key in data.properties) {
      klaviyoProperties[data.properties[key].name] = data.properties[key].value;
    }
  }

  if (eventName === 'Viewed Product') {
    let viewedItems = getViewedItems();

    if (viewedItems.length) {
      klaviyoProperties['$viewed_items'] = viewedItems;
    }
  }

  return klaviyoProperties;
}

function getCustomerProperties() {
  const customerProperties = {
    properties: {}
  };

  if (data.email) customerProperties.email = data.email;
  else if (eventData.email) customerProperties.email = eventData.email;
  else if (data.storeEmail) {
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

  if (eventData.page_referrer)
    customerProperties.properties['$last_referrer'] = eventData.page_referrer;

  if (data.customerStandardProperties) {
    for (let key in data.customerStandardProperties) {
      customerProperties[data.customerStandardProperties[key].name] =
        data.customerStandardProperties[key].value;
    }
  }

  if (data.customerLocationProperties) {
    customerProperties.location = {};

    for (let key in data.customerLocationProperties) {
      customerProperties.location[data.customerLocationProperties[key].name] =
        data.customerLocationProperties[key].value;
    }
  }

  if (data.customerProperties) {
    for (let key in data.customerProperties) {
      customerProperties.properties[data.customerProperties[key].name] =
        data.customerProperties[key].value;
    }
  }

  if (customerProperties.email && data.storeEmail) {
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
    httpOnly: false
  });
}

function getViewedItems() {
  let viewedItems = [];
  const viewedItemsCookie = getCookieValues('stape_klaviyo_viewed_items');

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
      CompareAtPrice: eventData.CompareAtPrice
    },
    Views: 1,
    LastViewedDate: makeInteger(getTimestampMillis() / 1000)
  });

  return viewedItems;
}

function hasUserIdentificationData(klaviyoEventData) {
  const profileData = klaviyoEventData.data.attributes.profile.data;
  return (
    !!profileData.id ||
    !!profileData.attributes.email ||
    !!profileData.attributes._kx ||
    !!profileData.attributes.external_id
  );
}

function hasItem(arr, item) {
  for (let k in arr) {
    if (arr[k] === item) return true;
  }

  return false;
}

function buildRequestHeaders() {
  return {
    'X-Forwarded-For': eventData.ip_override 
      ? eventData.ip_override.split(' ').join('').split(',')[0]
      : getRemoteAddress(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Revision: klaviyoApiRevision,
    Authorization: 'Klaviyo-API-Key ' + data.apiKey
  };
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