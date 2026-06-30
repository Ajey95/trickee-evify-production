import React, {useState, useRef, useCallback} from 'react';
import {View, StyleSheet, ActivityIndicator, Text} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView} from 'react-native-webview';
import {Colors} from '../constants/Colors';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  color?: string;
  icon?: 'car' | 'charger' | 'user' | 'destination';
}

interface OpenStreetMapProps {
  /** Initial center latitude */
  initialLatitude?: number;
  /** Initial center longitude */
  initialLongitude?: number;
  /** Initial zoom level (1-18) */
  initialZoom?: number;
  /** Array of markers to display */
  markers?: MapMarker[];
  /** Whether to show user's current location */
  showUserLocation?: boolean;
  /** Map height */
  height?: number;
  /** Corner radius for the map container */
  borderRadius?: number;
  /** Callback when a marker is tapped */
  onMarkerPress?: (markerId: string) => void;
}

const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  initialLatitude = 21.1702,
  initialLongitude = 72.8311,
  initialZoom = 14,
  markers = [],
  showUserLocation = true,
  height = 300,
  borderRadius = 20,
  onMarkerPress,
}) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Build marker icons based on type
  const getMarkerIcon = (icon?: string, color?: string): string => {
    const markerColor = color || Colors.trickeeYellow;
    switch (icon) {
      case 'car':
        return `
          L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${markerColor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px ${markerColor}80;border:2px solid rgba(255,255,255,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="${Colors.appBackground}"><path d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z"/></svg></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        `;
      case 'charger':
        return `
          L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${markerColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px ${markerColor}80;border:2px solid rgba(255,255,255,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M14.69,2.21L4.33,11.49C4.00,11.79,4.03,12.32,4.39,12.57L9.21,16.23L7.5,22L17.67,12.51C17.99,12.21,17.97,11.68,17.61,11.43L12.79,7.77L14.69,2.21Z"/></svg></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        `;
      case 'destination':
        return `
          L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${markerColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px ${markerColor}80;border:2px solid rgba(255,255,255,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"/></svg></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 28]
          })
        `;
      default:
        return `
          L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${markerColor};width:24px;height:24px;border-radius:50%;box-shadow:0 0 8px ${markerColor}80;border:2px solid rgba(255,255,255,0.3);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        `;
    }
  };

  // Build markers JavaScript
  const markersJS = markers
    .map(
      m => `
    L.marker([${m.latitude}, ${m.longitude}], {
      icon: ${getMarkerIcon(m.icon, m.color)}
    })
    .addTo(map)
    .bindPopup('<div style="background:#1a1a2e;color:#fff;padding:8px 12px;border-radius:8px;font-family:system-ui;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.1);min-width:80px;text-align:center;">${
      m.title
    }</div>', {
      className: 'dark-popup',
      closeButton: false
    })
    .on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'marker', id:'${
        m.id
      }'}));
    });
  `,
    )
    .join('\n');

  // User location JS — uses browser's navigator.geolocation inside the WebView
  const userLocationJS = showUserLocation
    ? `
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        window.userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'user-location',
            html: '<div style="position:relative;"><div style="width:18px;height:18px;background:${Colors.neonBlue};border-radius:50%;border:3px solid #fff;box-shadow:0 0 15px ${Colors.neonBlue};"></div><div style="position:absolute;top:-6px;left:-6px;width:30px;height:30px;border-radius:50%;background:${Colors.neonBlue}30;animation:pulse 2s infinite;"></div></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          })
        }).addTo(map)
        .bindPopup('<div style="background:#1a1a2e;color:#fff;padding:8px 12px;border-radius:8px;font-family:system-ui;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.1);">Your Location</div>', {
          className: 'dark-popup',
          closeButton: false
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'userLocation', lat:lat, lng:lng}));
      }, function(err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'locationError', message:err.message}));
      }, {enableHighAccuracy: true, timeout: 15000});
    }
  `
    : '';

  // Full HTML for the Leaflet map
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }

        .dark-popup .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
          border-radius: 8px;
        }
        .dark-popup .leaflet-popup-tip {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .dark-popup .leaflet-popup-content { margin: 0; }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        .leaflet-control-attribution {
          background: rgba(0,0,0,0.5) !important;
          color: rgba(255,255,255,0.4) !important;
          font-size: 8px !important;
          padding: 2px 6px !important;
          border-radius: 4px 0 0 0 !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255,202,32,0.6) !important;
        }

        .leaflet-control-zoom a {
          background: rgba(4,6,10,0.85) !important;
          color: #FFCA20 !important;
          border-color: rgba(255,255,255,0.12) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(4,6,10,0.95) !important;
        }

        .leaflet-tile-pane {
          filter: invert(1) hue-rotate(200deg) brightness(0.75) contrast(1.3) saturate(0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          center: [${initialLatitude}, ${initialLongitude}],
          zoom: ${initialZoom},
          zoomControl: true,
          attributionControl: true
        });
        window.map = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        ${markersJS}
        ${userLocationJS}

        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'mapReady'}));
      </script>
    </body>
    </html>
  `;

  // Handle messages from the WebView
  const handleMessage = useCallback(
    (event: {nativeEvent: {data: string}}) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        switch (data.type) {
          case 'marker':
            onMarkerPress?.(data.id);
            break;
          case 'mapReady':
            setLoading(false);
            break;
        }
      } catch (_e) {
        // Ignore parse errors
      }
    },
    [onMarkerPress],
  );

  return (
    <View style={[mapStyles.container, {height, borderRadius}]}>
      {WebView ? (
        <WebView
          ref={webViewRef}
          source={{html: mapHTML}}
          style={[mapStyles.webview, {borderRadius}]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={false} // Temporarily disabled to avoid native dependency issues
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          androidLayerType="hardware"
          startInLoadingState={true}
          renderLoading={() => (
            <View style={mapStyles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.trickeeYellow} />
              <Text style={mapStyles.loadingText}>Loading Map...</Text>
            </View>
          )}
        />
      ) : (
        <View style={mapStyles.loadingContainer}>
          <Icon name="map-marker-off" size={40} color={Colors.trickeeYellow} />
          <Text style={mapStyles.loadingText}>Map Module Unavailable</Text>
        </View>
      )}
      {loading && WebView && (
        <View style={mapStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.trickeeYellow} />
          <Text style={mapStyles.loadingText}>Loading Map...</Text>
        </View>
      )}
    </View>
  );
};

const mapStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.appBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 6, 10, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
  },
});

export default OpenStreetMap;
