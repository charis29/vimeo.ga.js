/*!
 * vimeo.ga.js | v0.6
 * Based on modifications by LukasBeaton (https://github.com/LukasBeaton/vimeo.ga.js)
 * Copyright (c) 2015 Sander Heilbron (http://www.sanderheilbron.nl)
 * MIT licensed
 */


var vimeoGAJS = (window.vimeoGAJS) ? window.vimeoGAJS : {};

(function($) {
  vimeoGAJS = {
    videos : [],
    gaTracker : undefined,
    eventMarker : {},

    init: function () {
      vimeoGAJS.videos = $('video');

      $.each(vimeoGAJS.videos, function (index, video) {
        var videoId = $(video).attr('id');

        vimeoGAJS.eventMarker[videoId] = {
          'progress25' : false,
          'progress50' : false,
          'progress75' : false,
          'videoPlayed' : false,
          'videoPaused' : false,
          'videoResumed' : false,
          'videoSeeking' : false,
          'videoCompleted' : false,
          'timePercentComplete' : 0
        };
      });

      // Check which version of Google Analytics is used
      if (typeof ga === "function") {
        vimeoGAJS.gaTracker = 'ua'; // Universal Analytics (universal.js)
        //console.info('Universal Analytics');
      }

      if (typeof _gaq !== "undefined" && typeof _gaq.push === "function") {
        vimeoGAJS.gaTracker = 'ga'; // Classic Analytics (ga.js)
        //console.info('Classic Analytics');
      }

      if (typeof dataLayer !== "undefined" && typeof dataLayer.push === "function") {
        vimeoGAJS.gaTracker = 'gtm'; // Google Tag Manager (dataLayer)
        //console.info('Google Tag Manager');
      }

      // Listen for messages from the player
      if (window.addEventListener) {
        window.addEventListener('message', vimeoGAJS.onMessageReceived, false);
      } else {
        window.attachEvent('onmessage', vimeoGAJS.onMessageReceived, false);
      }
    },

    // Handle messages received from the player
    onMessageReceived: function(e) {
      if (e.origin.replace('https:', 'http:') !== "http://player.vimeo.com" || typeof vimeoGAJS.gaTracker === 'undefined') {
        //console.warn('Tracker is missing!');
        return;
      }

      var data = JSON.parse(e.data),
          videoEl = $("#"+data.player_id),
          videoId = videoEl.attr('id');

      switch (data.event) {
      case 'ready':
        vimeoGAJS.onReady();
        break;

      case 'playProgress':
        vimeoGAJS.onPlayProgress(data.data, videoEl);
        break;

      case 'seek':
        if (videoEl.data('seek') && !vimeoGAJS.eventMarker[videoId].videoSeeking) {
          vimeoGAJS.sendEvent(videoEl, 'Skipped video forward or backward');
          vimeoGAJS.eventMarker[videoId].videoSeeking = true; // Avoid subsequent seek trackings
        }
        break;

      case 'play':
        if (!vimeoGAJS.eventMarker[videoId].videoPlayed) {
          vimeoGAJS.sendEvent(videoEl, 'Started video');
          vimeoGAJS.eventMarker[videoId].videoPlayed = true; // Avoid subsequent play trackings
        } else if (!vimeoGAJS.eventMarker[videoId].videoResumed && vimeoGAJS.eventMarker[videoId].videoPaused) {
          vimeoGAJS.sendEvent(videoEl, 'Resumed video');
          vimeoGAJS.eventMarker[videoId].videoResumed = true; // Avoid subsequent resume trackings
        }
        break;

      case 'pause':
        vimeoGAJS.onPause(videoEl);
        break;

      case 'finish':
        if (!vimeoGAJS.eventMarker[videoId].videoCompleted) {
          vimeoGAJS.sendEvent(videoEl, 'Completed video');
          vimeoGAJS.eventMarker[videoId].videoCompleted = true; // Avoid subsequent finish trackings
        }
        break;
      }
    },

    getLabel : function(videoEl) {
      var videoSrc = videoEl.attr('src').split('?')[0];
      var label = videoSrc;
      if (videoEl.data('title')) {
        label += ' (' + videoEl.data('title') + ')';
      } else if (videoEl.attr('title')) {
        label += ' (' + videoEl.attr('title') + ')';
      }
      return label;
    },

    // Helper function for sending a message to the player
    post : function (action, value, video) {
      var data = {
        method: action
      };

      if (value) {
        data.value = value;
      }

      // Source URL
      var videoSrc = $(video).attr('src').split('?')[0];

      video.contentWindow.postMessage(JSON.stringify(data), videoSrc);
    },

    onReady :function() {
      $.each(vimeoGAJS.videos, function(index, video) {
        vimeoGAJS.post('addEventListener', 'play', video);
        vimeoGAJS.post('addEventListener', 'seek', video);
        vimeoGAJS.post('addEventListener', 'pause', video);
        vimeoGAJS.post('addEventListener', 'finish', video);
        vimeoGAJS.post('addEventListener', 'playProgress', video);
      });
    },

    onPause: function(videoEl) {
      var videoId = videoEl.attr('id');
      if (vimeoGAJS.eventMarker[videoId].timePercentComplete < 99 && !vimeoGAJS.eventMarker[videoId].videoPaused) {
        vimeoGAJS.sendEvent(videoEl, 'Paused video');
        vimeoGAJS.eventMarker[videoId].videoPaused = true; // Avoid subsequent pause trackings
      }
    },

    // Tracking video progress
    onPlayProgress: function(data, videoEl) {
      var progress,
          videoId = videoEl.attr('id');
      vimeoGAJS.eventMarker[videoId].timePercentComplete = Math.round((data.percent) * 100); // Round to a whole number

      if (!videoEl.data('progress')) {
        return;
      }

      if (vimeoGAJS.eventMarker[videoId].timePercentComplete > 24 && !vimeoGAJS.eventMarker[videoId].progress25) {
        progress = 'Played video: 25%';
        vimeoGAJS.eventMarker[videoId].progress25 = true;
      }

      if (vimeoGAJS.eventMarker[videoId].timePercentComplete > 49 && !vimeoGAJS.eventMarker[videoId].progress50) {
        progress = 'Played video: 50%';
        vimeoGAJS.eventMarker[videoId].progress50 = true;
      }

      if (vimeoGAJS.eventMarker[videoId].timePercentComplete > 74 && !vimeoGAJS.eventMarker[videoId].progress75) {
        progress = 'Played video: 75%';
        vimeoGAJS.eventMarker[videoId].progress75 = true;
      }

      if (progress) {
        vimeoGAJS.sendEvent(videoEl, progress);
      }
    },

    // Send event to Classic Analytics, Universal Analytics or Google Tag Manager
    sendEvent: function (videoEl, action) {
      var bounce = videoEl.data('bounce');
      var label = vimeoGAJS.getLabel(videoEl);

      switch (vimeoGAJS.gaTracker) {
      case 'gtm':
        dataLayer.push({'event': 'Vimeo', 'eventCategory': 'Vimeo', 'eventAction': action, 'eventLabel': label, 'eventValue': undefined, 'eventNonInteraction': (bounce) ? false : true });
        break;

      case 'ua':
        ga('send', 'event', 'Vimeo', action, label, undefined, {'nonInteraction': (bounce) ? 0 : 1});
        break;

      case 'ga':
        _gaq.push(['_trackEvent', 'Vimeo', action, label, undefined, (bounce) ? false : true]);
        break;
      }
    }
  };

  vimeoGAJS.init();
})(jQuery);
