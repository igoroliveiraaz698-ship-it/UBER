import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, Alert, ScrollView, ActivityIndicator, Linking
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

// SEU BANCO DE DADOS REAL CONECTADO:
const FIREBASE_URL = 'https://firebaseio.com';

export default function App() {
  const [perfil, setPerfil] = useState(null); // 'passageiro' | 'motorista'
  const [nome, setNome] = useState('Igor');
  const [minhaPosicao, setMinhaPosicao] = useState({ lat: -22.7556, lng: -46.1447 }); // Camanducaia
  const [destinoPosicao, setDestinoPosicao] = useState(null);
  const [enderecoDestino, setEnderecoDestino] = useState('');
  const [corridaAtual, setCorridaAtual] = useState(null);
  const [listaPedidos, setListaPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const webViewRef = useRef(null);

  // 1. Pegar GPS Real do Celular
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS', 'Ative a localização para ver sua posição real no mapa.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const novaPos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setMinhaPosicao(novaPos);
    })();
  }, []);

  // 2. Sincronizar Corridas em Tempo Real com o seu Firebase (a cada 3 segundos)
  useEffect(() => {
    if (!perfil) return;
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`${FIREBASE_URL}/corridas.json`);
        const dados = await res.json();
        if (!dados) {
          setListaPedidos([]);
          if (perfil === 'passageiro') setCorridaAtual(null);
          return;
        }
        const arrayCorridas = Object.keys(dados).map((id) => ({ id, ...dados[id] }));
        
        if (perfil === 'motorista') {
          const pendentes = arrayCorridas.filter((c) => c.status === 'aguardando' || c.motorista === nome);
          setListaPedidos(pendentes.reverse());
        } else if (perfil === 'passageiro' && corridaAtual?.id) {
          const atualizada = dados[corridaAtual.id];
          if (atualizada) setCorridaAtual({ id: corridaAtual.id, ...atualizada });
        }
      } catch (e) {
        console.log('Erro sync:', e);
      }
    }, 3000);
    return () => clearInterval(intervalo);
  }, [perfil, corridaAtual?.id, nome]);

  // Calcular distância aproximada (km) e preço
  const calcularCorrida = () => {
    if (!destinoPosicao) return { km: 2.5, preco: '12,00' };
    const R = 6371;
    const dLat = ((destinoPosicao.lat - minhaPosicao.lat) * Math.PI) / 180;
    const dLon = ((destinoPosicao.lng - minhaPosicao.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((minhaPosicao.lat * Math.PI) / 180) *
        Math.cos((destinoPosicao.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = Math.max(1.2, (R * c * 1.3).toFixed(1));
    const valor = Math.max(8, km * 3.5 + 4).toFixed(2).replace('.', ',');
    return { km, preco: valor };
  };

  // Passageiro: Chamar Motorista
  const pedirCorrida = async () => {
    if (!destinoPosicao && !enderecoDestino.trim()) {
      Alert.alert('Destino', 'Toque em um ponto no mapa ou digite o destino!');
      return;
    }
    setCarregando(true);
    const info = calcularCorrida();
    const novaCorrida = {
      passageiro: nome,
      origem: minhaPosicao,
      destino: destinoPosicao || { lat: minhaPosicao.lat + 0.008, lng: minhaPosicao.lng + 0.008 },
      enderecoDestino: enderecoDestino || 'Ponto marcado no mapa',
      distancia: `${info.km} km`,
      valor: `R$ ${info.preco}`,
      status: 'aguardando',
      motorista: null,
      criadoEm: Date.now(),
    };

    try {
      const res = await fetch(`${FIREBASE_URL}/corridas.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaCorrida),
      });
      const data = await res.json();
      setCorridaAtual({ id: data.name, ...novaCorrida });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível conectar ao Firebase.');
    }
    setCarregando(false);
  };

  // Passageiro: Cancelar Corrida
  const cancelarCorrida = async () => {
    if (!corridaAtual?.id) return;
    await fetch(`${FIREBASE_URL}/corridas/${corridaAtual.id}.json`, { method: 'DELETE' });
    setCorridaAtual(null);
    setDestinoPosicao(null);
  };

  // Motorista: Aceitar ou Finalizar
  const atualizarStatusCorrida = async (id, novoStatus) => {
    if (novoStatus === 'finalizada') {
      await fetch(`${FIREBASE_URL}/corridas/${id}.json`, { method: 'DELETE' });
      Alert.alert('Corrida Finalizada!', 'O valor foi registrado com sucesso.');
      return;
    }
    await fetch(`${FIREBASE_URL}/corridas/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus, motorista: nome }),
    });
  };

  // Abrir GPS externo (Google Maps / Waze)
  const abrirNavegacaoExterna = (lat, lng) => {
    const url = `https://google.com{lat},${lng}`;
    Linking.openURL(url);
  };

  // HTML do Mapa Interativo Real (OpenStreetMap + Leaflet)
  const htmlMapa = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com" />
      <script src="https://unpkg.com"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${minhaPosicao.lat}, ${minhaPosicao.lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var euMarker = L.circleMarker([${minhaPosicao.lat}, ${minhaPosicao.lng}], {
          radius: 9, fillColor: "#2563eb", color: "#ffffff", weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup("Você está aqui");

        var destMarker = null;
        var linhaRota = null;

        ${destinoPosicao ? `
          destMarker = L.marker([${destinoPosicao.lat}, ${destinoPosicao.lng}]).addTo(map);
          linhaRota = L.polyline([[${minhaPosicao.lat}, ${minhaPosicao.lng}], [${destinoPosicao.lat}, ${destinoPosicao.lng}]], {color: '#111827', weight: 4}).addTo(map);
        ` : ''}

        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;
          if (destMarker) map.removeLayer(destMarker);
          if (linhaRota) map.removeLayer(linhaRota);
          destMarker = L.marker([lat, lng]).addTo(map);
          linhaRota = L.polyline([[${minhaPosicao.lat}, ${minhaPosicao.lng}], [lat, lng]], {color: '#111827', weight: 4}).addTo(map);
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
        });
      </script>
    </body>
    </html>
  `;

  // TELA INICIAL DE ESCOLHA DE PERFIL
  if (!perfil) {
    return (
      <SafeAreaView style={styles.containerLogin}>
        <Text style={styles.logo}>MeuApp Uber</Text>
        <Text style={styles.subtitulo}>Camanducaia • Conectado em Tempo Real</Text>

        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          value={nome}
          onChangeText={setNome}
        />

        <TouchableOpacity style={styles.btnPassageiro} onPress={() => setPerfil('passageiro')}>
          <Text style={styles.btnTextoBranco}>Entrar como Passageiro</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnMotorista} onPress={() => setPerfil('motorista')}>
          <Text style={styles.btnTextoBranco}>Entrar como Motorista</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const infoCalculada = calcularCorrida();

  return (
    <SafeAreaView style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>
          {nome} ({perfil === 'passageiro' ? 'PASSAGEIRO' : 'MOTORISTA'})
        </Text>
        <TouchableOpacity onPress={() => setPerfil(null)} style={styles.btnSair}>
          <Text style={styles.btnSairTexto}>Trocar</Text>
        </TouchableOpacity>
      </View>

      {/* MAPA INTERATIVO REAL */}
      <View style={styles.mapaBox}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlMapa }}
          style={{ flex: 1 }}
          onMessage={(event) => {
            if (perfil === 'passageiro' && !corridaAtual) {
              const coords = JSON.parse(event.nativeEvent.data);
              setDestinoPosicao(coords);
              if (!enderecoDestino) setEnderecoDestino('Destino marcado no mapa');
            }
          }}
        />
      </View>

      {/* PAINEL INFERIOR: PASSAGEIRO */}
      {perfil === 'passageiro' && (
        <View style={styles.painelInferior}>
          {!corridaAtual ? (
            <>
              <Text style={styles.dicaMapa}>Toque no mapa acima para marcar onde quer ir:</Text>
              <TextInput
                style={styles.inputMapa}
                placeholder="Ou digite o nome da rua / bairro..."
                value={enderecoDestino}
                onChangeText={setEnderecoDestino}
              />
              {destinoPosicao && (
                <View style={styles.resumoPreco}>
                  <Text style={styles.resumoTexto}>Distância: {infoCalculada.km} km</Text>
            
