import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Alert, AppState,
} from 'react-native';
import * as Location from 'expo-location';
import LiveMap from '../components/LiveMap';
import {
  connectOfficerSocket, respondToAssignment, markArrived,
  completeAssignment, fetchMyAssignments, officerLogout,
} from '../lib/api';

const STATUS_COLORS = {
  available: '#2E7D32',
  on_patrol: '#C05000',
  dispatched: '#A0141E',
  off_duty: '#777',
};

const STATUS_LABELS = {
  available: 'AVAILABLE',
  on_patrol: 'ON PATROL',
  dispatched: 'DISPATCHED',
  off_duty: 'OFF DUTY',
};

export default function HomeScreen({ route, navigation }) {
  const officer = route.params?.officer;
  const [status, setStatus] = useState('available');
  const [location, setLocation] = useState(null);
  const [incomingAssignment, setIncomingAssignment] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const socketRef = useRef(null);
  const locationWatchRef = useRef(null);

  // ── Connect WebSocket on mount ────────────────────────────────
  useEffect(() => {
    const sock = connectOfficerSocket(officer.id, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onError: () => setConnected(false),
      onAssignment: (assignment) => {
        setIncomingAssignment(assignment);
      },
    });
    socketRef.current = sock;

    loadAssignments();

    return () => sock.close();
  }, []);

  // ── Start GPS tracking ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Location required', 'IntelliPark needs location access to function.');
        return;
      }

      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 12000, distanceInterval: 25 },
        (loc) => {
          const { latitude, longitude, accuracy } = loc.coords;
          setLocation({ lat: latitude, lng: longitude });
          socketRef.current?.sendLocation(latitude, longitude, accuracy);
        }
      );
    })();

    return () => {
      locationWatchRef.current?.remove();
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    try {
      const list = await fetchMyAssignments();
      setHistory(list);
      const active = list.find((a) => ['accepted', 'en_route', 'arrived'].includes(a.status));
      if (active) {
        setActiveAssignment(active);
        setStatus('on_patrol');
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const handleStatusToggle = () => {
    const next = status === 'available' ? 'off_duty' : 'available';
    setStatus(next);
    socketRef.current?.sendStatus(next);
  };

  const handleAccept = async () => {
    if (!incomingAssignment) return;
    try {
      await respondToAssignment(incomingAssignment.id, 'accept');
      setActiveAssignment(incomingAssignment);
      setStatus('on_patrol');
      setIncomingAssignment(null);
    } catch (e) {
      Alert.alert('Error', 'Could not accept assignment');
    }
  };

  const handleDecline = async () => {
    if (!incomingAssignment) return;
    try {
      await respondToAssignment(incomingAssignment.id, 'decline');
      setIncomingAssignment(null);
    } catch (e) {
      Alert.alert('Error', 'Could not decline assignment');
    }
  };

  const handleArrived = async () => {
    if (!activeAssignment) return;
    try {
      await markArrived(activeAssignment.id);
      setActiveAssignment({ ...activeAssignment, status: 'arrived' });
    } catch (e) {
      Alert.alert('Error', 'Could not mark arrived');
    }
  };

  const handleComplete = async () => {
    if (!activeAssignment) return;
    try {
      await completeAssignment(activeAssignment.id);
      setActiveAssignment(null);
      setStatus('available');
      loadAssignments();
    } catch (e) {
      Alert.alert('Error', 'Could not complete assignment');
    }
  };

  const handleLogout = async () => {
    socketRef.current?.close();
    await officerLogout();
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerName}>{officer.name}</Text>
          <Text style={styles.headerUnit}>{officer.unit_name} · {officer.badge}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.signOut}>SIGN OUT</Text>
        </TouchableOpacity>
      </View>

      {/* Connection + status bar */}
      <View style={styles.statusBar}>
        <View style={styles.connDot}>
          <View style={[styles.dot, { backgroundColor: connected ? '#2E7D32' : '#A0141E' }]} />
          <Text style={styles.connText}>{connected ? 'LIVE' : 'RECONNECTING'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusPill, { backgroundColor: STATUS_COLORS[status] }]}
          onPress={handleStatusToggle}
          disabled={!!activeAssignment}
        >
          <Text style={styles.statusPillText}>{STATUS_LABELS[status]}</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {location ? (
          <LiveMap officerLocation={location} assignment={activeAssignment} />
        ) : (
          <View style={styles.mapLoading}>
            <Text style={styles.mapLoadingText}>Acquiring GPS signal...</Text>
          </View>
        )}
      </View>

      {/* Active assignment card */}
      {activeAssignment && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>ACTIVE ASSIGNMENT</Text>
          <Text style={styles.activeJunction}>{activeAssignment.junction}</Text>
          <View style={styles.activeRow}>
            <Text style={styles.activeMeta}>{activeAssignment.road_distance_km} km · ETA {activeAssignment.eta_minutes} min</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor(activeAssignment.risk_level) }]}>
              <Text style={styles.riskBadgeText}>{activeAssignment.risk_level}</Text>
            </View>
          </View>
          {activeAssignment.status !== 'arrived' ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleArrived}>
              <Text style={styles.primaryBtnText}>MARK ARRIVED</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
              <Text style={styles.primaryBtnText}>COMPLETE PATROL</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Incoming assignment modal */}
      <Modal visible={!!incomingAssignment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalLabel}>NEW ASSIGNMENT</Text>
            <Text style={styles.modalJunction}>{incomingAssignment?.junction}</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor(incomingAssignment?.risk_level), alignSelf: 'flex-start', marginTop: 8 }]}>
              <Text style={styles.riskBadgeText}>{incomingAssignment?.risk_level}</Text>
            </View>
            <Text style={styles.modalMeta}>
              {incomingAssignment?.road_distance_km} km away · ETA {incomingAssignment?.eta_minutes} min
            </Text>
            <Text style={styles.modalSub}>Calculated via Bidirectional A* routing</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
                <Text style={styles.declineBtnText}>DECLINE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Text style={styles.acceptBtnText}>ACCEPT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function riskColor(level) {
  return { Critical: '#A0141E', High: '#C05000', Moderate: '#C08000', Low: '#2E7D32' }[level] || '#777';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EDE8' },
  header: {
    backgroundColor: '#111010', paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerName: { color: '#F0EDE8', fontSize: 17, fontWeight: '700' },
  headerUnit: { color: 'rgba(240,237,232,0.5)', fontSize: 12, marginTop: 2 },
  signOut: { color: 'rgba(240,237,232,0.4)', fontSize: 11, letterSpacing: 1 },

  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  connDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connText: { fontSize: 11, letterSpacing: 1, color: '#555', fontWeight: '700' },
  statusPill: { paddingHorizontal: 14, paddingVertical: 6 },
  statusPillText: { color: '#fff', fontSize: 11, letterSpacing: 1, fontWeight: '700' },

  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e8e4dc' },
  mapLoadingText: { color: '#555', fontSize: 14 },

  activeCard: {
    backgroundColor: '#fff', padding: 18, borderTopWidth: 3, borderTopColor: '#A0141E',
  },
  activeLabel: { fontSize: 11, letterSpacing: 1.5, color: '#555', fontWeight: '700' },
  activeJunction: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 4 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  activeMeta: { fontSize: 13, color: '#444', fontWeight: '600' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  riskBadgeText: { color: '#fff', fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  primaryBtn: { backgroundColor: '#A0141E', padding: 14, alignItems: 'center', marginTop: 14 },
  completeBtn: { backgroundColor: '#2E7D32', padding: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { color: '#fff', fontSize: 13, letterSpacing: 1.5, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 26, borderTopWidth: 4, borderTopColor: '#A0141E' },
  modalLabel: { fontSize: 12, letterSpacing: 2, color: '#A0141E', fontWeight: '700' },
  modalJunction: { fontSize: 22, fontWeight: '700', color: '#111', marginTop: 8 },
  modalMeta: { fontSize: 14, color: '#444', marginTop: 12, fontWeight: '600' },
  modalSub: { fontSize: 12, color: '#888', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  declineBtn: { flex: 1, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  declineBtnText: { color: '#444', fontSize: 13, letterSpacing: 1, fontWeight: '700' },
  acceptBtn: { flex: 1, padding: 15, alignItems: 'center', backgroundColor: '#A0141E' },
  acceptBtnText: { color: '#fff', fontSize: 13, letterSpacing: 1, fontWeight: '700' },
});
