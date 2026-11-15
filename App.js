import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, Alert, ScrollView, ActivityIndicator, Linking
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

const DB = 'https://firebaseio.com';

export default function App() {
  const [modo, setModo] = useState(null);
  const [nome, setNome] = useState('Igor');
  const [pos, setPos] = useState({ lat: -22.7556, lng: -46.1447 });
  const [dest, setDest] = useState(null);
  const [rua, setRua] = useState('');
  const [minhaCorrida, setMinhaCorrida] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then(l => {
          setPos({ lat: l.coords.latitude, lng: l.coords.longitude });
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!modo) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${DB}.json`);
        const d = await r.json();
        if (!d) {
          setPedidos([]);
          if (modo === 'passageiro') setMinhaCorrida(null);
          return;
        }
        const lista = Object.keys(d).map(id => ({ id, ...d[id] }));
        if (modo === 'motorista') setPedidos(lista.reverse());
        if (modo === 'passageiro' && minhaCorrida) {
          if (d[minhaCorrida.id]) setMinhaCorrida({ id: minhaCorrida.id, ...d[minhaCorrida.id] });
          else setMinhaCorrida(null);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(t);
  }, [modo, minhaCorrida]);

  const calcularPreco = () => {
    if (!dest) return { km: '2.0', valor: '12,00' };
    const R = 6371;
    const dLat = ((dest.lat - pos.lat) * Math.PI) / 180;
    const dLon = ((dest.lng - pos.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((pos.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const km = Math.max(1.2, (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3)).toFixed(1);
    const valor = Math.max(8, Number(km) * 3.5 + 4).toFixed(2).replace('.', ',');
    return { km, valor };
  };

  const pedir = async () => {
    if (!dest && !rua.trim()) {
      Alert.alert('Destino', 'Toque no mapa ou digite o nome da rua!');
      return;
    }
    setCarregando(true);
    const info = calcularPreco();
    const body = {
      passageiro: nome,
      origem: pos,
      destinoCoords: dest || pos,
      destino: rua || 'Ponto marcado no mapa',
      distancia: `${info.km} km`,
      valor: `R$ ${info.valor}`,
      status: 'aguardando',
      motorista: ''
    };
    const r = await fetch(`${DB}.json`, { method: 'POST', body: JSON.stringify(body) });
    const d = await r.json();
    setMinhaCorrida({ id: d.name, ...body });
    setCarregando(false);
  };

  const aceitar = (id) => fetch(`${DB}/${id}.json`, { method: 'PATCH', body: JSON.stringify({ status: 'aceita', motorista: nome }) });
  const finalizar = (id) => fetch(`${DB}/${id}.json`, { method: 'DELETE' });

  const mapa = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com"/><script src="https://unpkg.com"></script><style>body,html,#m{margin:0;height:100%;width:100%}</style></head><body><div id="m"></div><script>var m=L.map('m',{zoomControl:false}).setView([${pos.lat},${pos.lng}],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(m);L.circleMarker([${pos.lat},${pos.lng}],{radius:8,fillColor:'#2563eb',color:'#fff',weight:3,fillOpacity:1}).addTo(m);var mk,ln;${dest ? `mk=L.marker([${dest.lat},${dest.lng}]).addTo(m);ln=L.polyline([[${pos.lat},${pos.lng}],[${dest.lat},${dest.lng}]],{color:'#111',weight:4}).addTo(m);` : ''}m.on('click',function(e){if(mk)m.removeLayer(mk);if(ln)m.removeLayer(ln);mk=L.marker(e.latlng).addTo(m);ln=L.polyline([[${pos.lat},${pos.lng}],e.latlng],{color:'#111',weight:4}).addTo(m);window.ReactNativeWebView.postMessage(JSON.stringify(e.latlng))});</script></body></html>`;

  if (!modo) return (
    <SafeAreaView style={s.login}>
      <Text style={s.titulo}>MeuApp Uber</Text>
      <Text style={s.sub}>Camanducaia & Monte Verde • Tempo Real</Text>
      <TextInput style={s.input} value={nome} onChangeText={setNome} placeholder="Seu nome" />
      <TouchableOpacity style={s.btnAzul} onPress={() => setModo('passageiro')}><Text style={s.txt}>Entrar como Passageiro</Text></TouchableOpacity>
      <TouchableOpacity style={s.btnVerde} onPress={() => setModo('motorista')}><Text style={s.txt}>Entrar como Motorista</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const info = calcularPreco();

  return (
    <SafeAreaView style={s.tela}>
      <View style={s.topo}>
        <Text style={s.txt}>{nome} ({modo.toUpperCase()})</Text>
        <TouchableOpacity style={s.btnTrocar} onPress={() => setModo(null)}><Text style={s.txtPeq}>Trocar</Text></TouchableOpacity>
      </View>

      <WebView
        source={{ html: mapa }}
        style={{ flex: 1 }}
        onMessage={e => {
          if (modo === 'passageiro' && !minhaCorrida) {
            setDest(JSON.parse(e.nativeEvent.data));
            if (!rua) setRua('Ponto marcado no mapa');
          }
        }}
      />

      {modo === 'passageiro' ? (
        <View style={s.box}>
          {!minhaCorrida ? (
            <>
              <Text style={s.dica}>Toque no mapa acima para marcar seu destino:</Text>
              <TextInput style={s.input} value={rua} onChangeText={setRua} placeholder="Ou digite o endereço..." />
              {dest && <Text style={s.preco}>Distância: {info.km} km • Valor: R$ {info.valor}</Text>}
              <TouchableOpacity style={s.btnPreto} onPress={pedir} disabled={carregando}>
                {carregando ? <ActivityIndicator color="#fff" /> : <Text style={s.txt}>Chamar Motorista</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.aviso}>{minhaCorrida.status === 'aguardando' ? 'Procurando motorista próximo...' : `Motorista ${minhaCorrida.motorista} a caminho!`}</Text>
              <Text style={s.subCard}>{minhaCorrida.destino} • {minhaCorrida.valor}</Text>
              <TouchableOpacity style={s.btnVermelho} onPress={() => { finalizar(minhaCorrida.id); setMinhaCorrida(null); setDest(null); }}>
                <Text style={s.txt}>Cancelar Corrida</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={s.boxMotorista}>
          <Text style={s.tituloFila}>Chamados em Tempo Real ({pedidos.length})</Text>
          <ScrollView>
            {pedidos.length === 0 ? <Text style={{ color: '#666' }}>Aguardando passageiros...</Text> : pedidos.map(p => (
              <View key={p.id} style={s.card}>
                <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{p.passageiro} • {p.valor} ({p.distancia})</Text>
                <Text style={{ color: '#444', marginVertical: 4 }}>Destino: {p.destino}</Text>
                {p.status === 'aguardando' ? (
                  <TouchableOpacity style={s.btnVerde} onPress={() => aceitar(p.id)}><Text style={s.txt}>Aceitar Corrida</Text></TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.btnAzul, { flex: 1, marginBottom: 0 }]} onPress={() => Linking.openURL(`https://google.com{p.origem.lat},${p.origem.lng}`)}>
                      <Text style={s.txt}>Abrir GPS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btnPreto, { flex: 1, marginTop: 0 }]} onPress={() => finalizar(p.id)}>
                      <Text style={s.txt}>Finalizar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  login: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#111827' },
  titulo: { color: '#fff', fontSize: 30, fontWeight: 'bold', textAlign: 'center' },
  sub: { color: '#9ca3af', textAlign: 'center', marginBottom: 24, marginTop: 4 },
  tela: { flex: 1, backgroundColor: '#f3f4f6' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#111827' },
  btnTrocar: { backgroundColor: '#374151', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  txtPeq: { color: '#fff', fontSize: 12 },
  box: { padding: 16, backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  boxMotorista: { padding: 16, backgroundColor: '#fff', height: '42%', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  dica: { fontSize: 13, color: '#4b5563', marginBottom: 6, fontWeight: '600' },
  preco: { fontSize: 16, fontWeight: 'bold', color: '#10b981', marginBottom: 10 },
  input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 10, fontSize: 15 },
  btnAzul: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  btnVerde: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  btnPreto: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  btnVermelho: { backgroundColor: '#ef4444', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
            txt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
aviso: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
subCard: { color: '#4b5563', marginTop: 4 },
tituloFila: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
card: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 10, backgroundColor: '#f9fafb' }
});
