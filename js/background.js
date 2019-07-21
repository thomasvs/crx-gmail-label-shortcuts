/**
 * GDE Sample: Chrome extension Google APIs.
 *
 * This Chrome extension is example code of how to use Chrome's identity API
 * to get access to Google's web APIs.
 */

// thomas: make token global

var global_token;
var global_labels;

/**
 * Create a basic Desktop notification.
 *
 * @param {object} options
 *   @value {string} iconUrl - Image URL to display in notification.
 *   @value {string} title - Notification header.
 *   @value {string} message - Notification message.
 */
function createBasicNotification(options) {
    var notificationOptions = {
        'type': 'basic',
        'iconUrl': options.iconUrl, // Relative to Chrome dir or remote URL must be whitelisted in manifest.
        'title': options.title,
        'message': options.message,
        'isClickable': true,
    };
    chrome.notifications.create(options.id, notificationOptions, function(notificationId) {});
}

/**
 * Show a notification that prompts the user to authenticate their Google account.
 */
function showAuthNotification() {
    var options = {
        'id': 'start-auth',
        'iconUrl': 'img/developers-logo.png',
        'title': 'GDE Sample: Chrome extension Google APIs',
        'message': 'Click here to authorize access to Gmail',
    };
    createBasicNotification(options);
}

/**
 * Show a notification that authentication was completed successfully.
 *
 * @param {object} profile
 *   @value {string} imageUrl - Google+ profile image URL.
 *   @value {string} displayName - Google+ profile full name.
 */
function showProfileNotification(profile) {
    var options = {
        'id': 'show-profile',
        'iconUrl': profile.imageUrl,
        'title': 'Welcome ' + profile.displayName,
        'message': 'Gmail checker is now active',
    };
    createBasicNotification(options);
}

/**
 * Triggered anytime user clicks on a desktop notification.
 */
function notificationClicked(notificationId){
    // User clicked on notification to start auth flow.
    if (notificationId === 'start-auth') {
        getAuthTokenInteractive();
    }
    clearNotification(notificationId);
}

/**
 * Clear a desktop notification.
 *
 * @param {string} notificationId - Id of notification to clear.
 */
function clearNotification(notificationId) {
    chrome.notifications.clear(notificationId, function(wasCleared) {});
}

/**
 * Get users access_token.
 *
 * @param {object} options
 *   @value {boolean} interactive - If user is not authorized ext, should auth UI be displayed.
 *   @value {function} callback - Async function to receive getAuthToken result.
 */
function getAuthToken(options) {
    chrome.identity.getAuthToken({ 'interactive': options.interactive }, options.callback);
}

/**
 * Get users access_token in background with now UI prompts.
 */
function getAuthTokenSilent() {
    getAuthToken({
        'interactive': false,
        'callback': getAuthTokenSilentCallback,
    });
}

/**
 * Get users access_token or show authorize UI if access has not been granted.
 */
function getAuthTokenInteractive() {
    getAuthToken({
        'interactive': true,
        'callback': getAuthTokenInteractiveCallback,
    });
}

/**
 * If user is authorized, start getting Gmail count.
 *
 * @param {string} token - Users access_token.
 */
function getAuthTokenSilentCallback(token) {
    // Catch chrome error if user is not authorized.
    if (chrome.runtime.lastError) {
        showAuthNotification();
    } else {
        updateLabelCount(token);
	/* thomasvs: do more token stuff later */
	global_token = token;
	getLabels(token);
    }
}

/**
 * User finished authorizing, start getting Gmail count.
 *
 * @param {string} token - Current users access_token.
 */
function getAuthTokenInteractiveCallback(token) {
    // Catch chrome error if user is not authorized.
    if (chrome.runtime.lastError) {
        showAuthNotification();
    } else {
        updateLabelCount(token);
        getProfile(token);
    }
}

/**
 * Get the current users Google+ profile to welcome them.
 *
 * https://developers.google.com/+/api/latest/people/get
 *
 * @param {string} token - Current users access_token.
 */
function getProfile(token) {
    get({
        'url': 'https://www.googleapis.com/plus/v1/people/me',
        'callback': getProfileCallback,
        'token': token,
    });
}

/**
 * Got users Google+ profile, show welcome desktop notification.
 *
 * https://developers.google.com/+/api/latest/people/get
 *
 * @param {object} person - Google+ person resource.
 */
function getProfileCallback(person) {
    var options = {
        'displayName': person.displayName,
        'imageUrl': person.image.url + '0',
    };
    showProfileNotification(options);
}

/**
 * Get details about the users Gmail inbox.
 *
 * https://developers.google.com/gmail/api/v1/reference/users/labels/get
 *
 * @param {string} token - Current users access_token.
 */
function updateLabelCount(token) {
    get({
        'url': 'https://www.googleapis.com/gmail/v1/users/me/labels/INBOX',
        'callback': updateLabelCountCallback,
        'token': token,
    });
}

/**
 * Got users Gmail inbox details.
 *
 * https://developers.google.com/gmail/api/v1/reference/users/labels/get
 *
 * @param {object} label - Gmail users.labels resource.
 */
function updateLabelCountCallback(label) {
    setBadgeCount(label.threadsUnread);
}

/* thomasvs: do more token stuff */
function getLabels(token) {
    get({
        'url': 'https://www.googleapis.com/gmail/v1/users/me/labels',
        'callback': getLabelsCallback,
        'token': token,
    });
}

function getLabelsCallback(labels) {

    global_labels = new Object();

    labels.labels.forEach(function (label, index) {
        global_labels[label['name']] = label['id'];
    });
    console.log('next action label id: ' + global_labels['@GTD/S/nextaction']);
    console.log('waiting for label id: ' + global_labels['@GTD/S/waitingfor']);
}

function labelCurrentThreadsAs(token, label) {
    function labelThread(threadId) {
        var data = new FormData();
	var remove = [ 'INBOX' ];
	if (label == '@GTD/S/nextaction') {
	    remove.push(global_labels['@GTD/S/waitingfor']);
	}
	if (label == '@GTD/S/waitingfor') {
	    remove.push(global_labels['@GTD/S/nextaction']);
	}

	console.log('remove:');
	console.log(remove);

        data = '{ ' +
            ' "addLabelIds": [ "' + global_labels[label] + '" ] ' +
            ', ' +
            ' "removeLabelIds": [ ' + remove.map(l => `'${l}'`).join(',') + ' ] ' +
        '} ';

        post({
            'url': 'https://www.googleapis.com/gmail/v1/users/me/threads/' + threadId + '/modify',
            'callback': null,
            'token': token
        }, data);
    }

    getActiveThreadId(labelThread);
}

function getMessages(token) {
    get({
        'url': 'https://www.googleapis.com/gmail/v1/users/me/messages',
        'callback': getMessagesCallback,
        'token': token,
    });
}

function getMessagesCallback(messages) {
    console.log('getMessages: message 0: ');
    console.log(messages.messages[0]);
    getMessage(global_token, messages.messages[0].id);
}

function getMessage(token, id) {
    get({
        'url': 'https://www.googleapis.com/gmail/v1/users/me/messages/' + id,
        'callback': getMessageCallback,
        'token': token,
    });
}


function getMessageCallback(message) {
    console.log('getMessage: message ' + message);
    //console.log('getMessages: message id: ' + messages[0].id);
    //getActiveThreadId(labelThread);
}

/* gets the currently active mail thread id,
 * and calls the given callback with it */
function getActiveThreadId(callback) {
    chrome.tabs.executeScript(null, {
        code: "document.querySelector('[role=\"main\"] [data-legacy-thread-id]').getAttribute('data-legacy-thread-id')"},
        function(results) { callback(results[0]); }
    );
}

/**
 * Make an authenticated HTTP GET request.
 *
 * @param {object} options
 *   @value {string} url - URL to make the request to. Must be whitelisted in manifest.json
 *   @value {string} token - Google access_token to authenticate request with.
 *   @value {function} callback - Function to receive response.
 */
function get(options) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            // JSON response assumed. Other APIs may have different responses.
            options.callback(JSON.parse(xhr.responseText));
        } else {
            console.log('get', xhr.readyState, xhr.status, xhr.responseText);
        }
    };
    xhr.open("GET", options.url, true);
    // Set standard Google APIs authentication header.
    xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    xhr.send();
}

function post(options, data) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            // JSON response assumed. Other APIs may have different responses.
            if (options.callback) { options.callback(JSON.parse(xhr.responseText)); }
        } else {
            console.log('post', xhr.readyState, xhr.status, xhr.responseText);
        }
    };
    xhr.open("POST", options.url, true);
    // Set standard Google APIs authentication header.
    xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.send(data);
}
/**
 * Set browserAction status.
 *
 * @param {object} options
 *   @value {string} text - Up to four letters to be visible on browserAction.
 *   @value {string} color - Text background color. E.g. #FF0000
 *   @value {string} title - The hover tooltip.
 */
function setBadge(options) {
    chrome.browserAction.setBadgeText({ 'text': options.text });
    chrome.browserAction.setBadgeBackgroundColor({ 'color': options.color });
    chrome.browserAction.setTitle({ 'title': options.title });
}

/**
 * Set the browserAction status for unauthenticated user.
 */
function setBadgeNoAuth() {
    setBadge({
        'text': '?',
        'color': '#9E9E9E',
        'title': 'Click to authorize Gmail',
    });
}

/**
 * Set the browserAction status for Gmail label count.
 *
 * @param {int} count - The count of unread emails in label.
 */
function setBadgeCount(count) {
    var color = '#9E9E9E';
    var title = 'No unread mail';
    if (count > 0) {
        color = '#F44336';
        title = count + ' unread mail';
    }
    setBadge({
        'text': count + '', // Cast count int to string.
        'color': color,
        'title': title,
    });
}

/**
 * User clicked on browserAction button. Check if user is authenticated.
 *
 * @param {object} tab - Chrome tab resource.
 */
function browserActionClicked(tab) {
    getAuthToken({
        'interactive': false,
        'callback': getBrowserActionAuthTokenCallback,
    });
}

/**
 * If user is authenticated open Gmail in new tab or start auth flow.
 *
 * @param {string} token - Current users access_token.
 */
function getBrowserActionAuthTokenCallback(token) {
    if (chrome.runtime.lastError) {
        getAuthTokenInteractive();
    } else {
        chrome.tabs.create({ 'url': 'https://mail.google.com' });
    }

}

/**
 * Chrome alarm has triggered.
 *
 * @param {object} alarm - Chrome alarm resource.
 */
function onAlarm(alarm) {
    // Check Gmail for current unread count.
    if (alarm.name === 'update-count') {
        getAuthTokenSilent();
    }
}

/**
 * Wire up Chrome event listeners.
 */
chrome.notifications.onClicked.addListener(notificationClicked);
chrome.browserAction.onClicked.addListener(browserActionClicked);
chrome.alarms.onAlarm.addListener(onAlarm);

// thomasvs: react on keypresses
chrome.commands.onCommand.addListener(function(command) {
  console.log('onCommand event received for message: ', command);
  if (command == 'next-action') {
    labelCurrentThreadsAs(global_token, '@GTD/S/nextaction');
  } else if (command == 'waiting-for') {
    labelCurrentThreadsAs(global_token, '@GTD/S/waitingfor');
  }
});

/**
 * Perform initial auth checks and set alarm for periodic updates.
 */
setBadgeNoAuth();
getAuthTokenSilent();
chrome.alarms.create('update-count', { 'delayInMinutes': 15, 'periodInMinutes': 15 });
