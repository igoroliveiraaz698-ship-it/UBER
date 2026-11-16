import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  Alert, ScrollView, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

const DB = 'https://firebaseio.com';

export default function App() {
  const [modo, setModo] = useState(null);
  const [nome, setNome] = useState('Igor');
  const [carro, setCarro] = useState('');
  const [placa, setPlaca] = useState('');
  const [categoria, setCategoria] = useState('UberX');
  const [pos, setPos] = useState({ lat: -22.7556, lng: -46.1447 });
  const [dest, setDest] = useState(null);
  const [rua, setRua] = useState('');
  const [minhaCorrida, setMinhaCorrida] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch (e) {}
    })();
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
          if (d[minhaCorrida.id]) {
            setMinhaCorrida({ id: minhaCorrida.id, ...d[minhaCorrida.id] });
          } else {
            setMinhaCorrida(null);
          }
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(t);
  }, [modo, minhaCorrida]);

  const buscarEndereco = async () => {
    if (!rua.trim()) {
      return Alert.alert('Endereço', 'Digite o nome da rua, bairro ou cidade.');
    }
    setCarregando(true);
    try {
      const url = `https://openstreetmap.org{encodeURIComponent(rua + ', Brasil')}&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MeuAppUber/1.0' } });
      const dados = await res.json();
      if (dados && dados.length > 0) {
        setDest({ lat: parseFloat(dados.lat), lng: parseFloat(dados.lon) });
      } else {
        Alert.alert('Não encontrado', 'Coloque o nome da cidade junto, ou toque direto no mapa.');
      }
    } catch (e) {
      Alert.alert('Aviso', 'Toque diretamente no mapa para marcar o destino.');
    }
    setCarregando(false);
  };

  const calcularPreco = () => {
    let km = 2.0;
    if (dest) {
      const R = 6371;
      const dLat = ((dest.lat - pos.lat) * Math.PI) / 180;
      const dLon = ((dest.lng - pos.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((pos.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      km = Math.max(1.2, R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3);
    }
    const tarifaBase = categoria === 'Moto' ? 3.0 : 5.0;
    const tarifaKm = categoria === 'Moto' ? 2.2 : 3.5;
    const valor = Math.max(7, km * tarifaKm + tarifaBase).toFixed(2).replace('.', ',');
    return { km: km.toFixed(1), valor };
  };

  const pedir = async () => {
    if (!dest && !rua.trim()) {
      return Alert.alert('Destino', 'Busque um endereço ou toque em um ponto do mapa.');
    }
    setCarregando(true);
    const info = calcularPreco();
    const body = {
      passageiro: nome,
      categoria: categoria,
      origem: pos,
      destinoCoords: dest || pos,
      destino: rua || 'Ponto marcado no mapa',
      distancia: `${info.km} km`,
      valor: `R$ ${info.valor}`,
      status: 'aguardando',
      motorista: '',
      veiculo: '',
      placa: ''
    };
    try {
      const r = await fetch(`${DB}.json`, { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      setMinhaCorrida({ id: d.name, ...body });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido agora.');
    }
    setCarregando(false);
  };

  const aceitar = (id) => {
    fetch(`${DB}/${id}.json`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'aceita',
        motorista: nome,
        veiculo: carro || 'Veículo Parceiro',
        placa: placa.toUpperCase() || 'SEM PLACA'
      })
    });
  };

  const finalizar = (id) => fetch(`${DB}/${id}.json`, { method: 'DELETE' });

  const entrarMotorista = () => {
    if (!nome.trim() || !carro.trim() || !placa.trim()) {
      return Alert.alert('Cadastro', 'Preencha seu Nome, Modelo/Cor do Veículo e Placa.');
    }
    setModo('motorista');
  };

  const destScript = dest
    ? `markerDest = L.marker([${dest.lat}, ${dest.lng}]).addTo(map);
       rotaLinha = L.polyline([[${pos.lat}, ${pos.lng}], [${dest.lat}, ${dest.lng}]], { color: '#000000', weight: 5 }).addTo(map);
       map.fitBounds(rotaLinha.getBounds(), { padding: [40, 40] });`
    : '';

  const mapaHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<link rel="stylesheet" href="https://unpkg.com"/>
<script src="https://unpkg.com"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #18181b; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${pos.lat}, ${pos.lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '' }).addTo(map);
  L.circleMarker([${pos.lat}, ${pos.lng}], { radius: 9, fillColor: '#3b82f6', color: '#ffffff', weight: 3, fillOpacity: 1 }).addTo(map);
  var markerDest = null;
  var rotaLinha = null;
  ${destScript}
  map.on('click', function(e) {
    if (markerDest) map.removeLayer(markerDest);
    if (rotaLinha) map.removeLayer(rotaLinha);
    markerDest = L.marker(e.latlng).addTo(map);
    rotaLinha = L.polyline([[${pos.lat}, ${pos.lng}], e.latlng], { color: '#000000', weight: 5 }).addTo(map);
    window.ReactNativeWebView.postMessage(JSON.stringify(e.latlng));
  });
</script>
</body>
</html>`;

  if (!modo) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.telaPreta}>
        <StatusBar barStyle="light-content" backgroundColor="#09090b" />
        <ScrollView contentContainerStyle={s.scrollLogin} keyboardShouldPersistTaps="handled">
          <Text style={s.logo}>UBER</Text>
          <Text style={s.sub}>Mobilidade em Tempo Real • Brasil</Text>

          <View style={s.cartao}>
            <Text style={s.label}>SEU NOME</Text>
            <TextInput
              style={s.inputEscuro}
              value={nome}
              onChangeText={setNome}
              placeholder="Digite seu nome"
              placeholderTextColor="#71717a"
            />
            <TouchableOpacity style={s.btnBranco} onPress={() => setModo('passageiro')}>
              <Text style={s.txtPreto}>Entrar como Passageiro</Text>
            </TouchableOpacity>
          </View>

          <View style={s.cartao}>
            <Text style={s.tituloSecao}>ÁREA DO MOTORISTA</Text>
            <Text style={s.label}>MODELO E COR DO VEÍCULO</Text>
            <TextInput
              style={s.inputEscuro}
              value={carro}
              onChangeText={setCarro}
              placeholder="Ex: Onix Prata ou Honda CG"
              placeholderTextColor="#71717a"
            />
            <Text style={s.label}>PLACA DO VEÍCULO</Text>
            <TextInput
              style={s.inputEscuro}
              value={placa}
              onChangeText={setPlaca}
              placeholder="Ex: ABC-1234"
              placeholderTextColor="#71717a"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={s.btnVerde} onPress={entrarMotorista}>
              <Text style={s.txtBranco}>Ficar Online como Motorista</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const info = calcularPreco();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.telaPreta}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      <View style={s.barraTopo}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomeTopo}>{nome} • {modo === 'passageiro' ? 'PASSAGEIRO' : 'MOTORISTA'}</Text>
          {modo === 'motorista' && (
            <Text style={s.subTopo}>{carro} • {placa.toUpperCase()}</Text>
          )}
        </View>
        <TouchableOpacity style={s.btnSair} onPress={() => setModo(null)}>
          <Text style={s.txtBrancoPeq}>Trocar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.areaMapa}>
        <WebView
          originWhitelist={['*']}
          source={{ html: mapaHtml }}
          style={{ flex: 1, backgroundColor: '#18181b' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          onMessage={e => {
            if (modo === 'passageiro' && !minhaCorrida) {
              setDest(JSON.parse(e.nativeEvent.data));
              if (!rua) setRua('Ponto marcado no mapa');
            }
          }}
        />
      </View>

      {modo === 'passageiro' ? (
        <View style={s.painelInferior}>
          {!minhaCorrida ? (
            <>
              <Text style={s.label}>PARA ONDE VAMOS? (BUSQUE OU TOQUE NO MAPA)</Text>
      
