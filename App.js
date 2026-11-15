import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Switch, ScrollView, Linking } from 'react-native';

const FIREBASE_URL = 'https://firebaseio.com';

export default function App() {
  const [user, setUser] = useState(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('PASSAGEIRO');
  const [carro, setCarro] = useState('Chevrolet Onix');
  const [cor, setCor] = useState('Prata');
  const [placa, setPlaca] = useState('ABC-1D23');
  const [origem, setOrigem] = useState('Rua Conego Cincinato Cabral - Centro');
  const [destino, setDestino] = useState('');
  const [sugO, setSugO] = useState([]);
  const [sugD, setSugD] = useState([]);
  const [pgto, setPgto] = useState('Pix');
  const [preco, setPreco] = useState(null);
  const [lista, setLista] = useState({});
  const [meuId, setMeuId] = useState(null);
  const [online, setOnline] = useState(true);
  const [ganhos, setGanhos] = useState(0);

  const ruas = [
    'Rua Dominio Pedro Ramos - Camanducaia',
    'Avenida Presidente Vargas - Centro',
    'Rua Conego Cincinato Cabral - Centro',
    'Rua Major Jose Inacio - Centro',
    'Rua Sao Jose - Centro',
    'Praca da Matriz - Centro',
    'Avenida Monte Verde - Acesso'
  ];

  useEffect(() => {
    if (!user || FIREBASE_URL.includes('SEU-PROJETO')) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${FIREBASE_URL}/corridas.json`);
        const d = await r.json();
        setLista(d || {});
      } catch (e) {}
    }, 2000);
    return () => clearInterval(t);
  }, [user]);

  const nuvem = async (id, dados) => {
    const n = { ...lista };
    dados === null ? delete n[id] : (n[id] = dados);
    setLista(n);
    if (FIREBASE_URL.includes('SEU-PROJETO')) return;
    try {
      await fetch(`${FIREBASE_URL}/corridas/${id}.json`, {
        method: dados === null ? 'DELETE' : 'PUT',
        body: dados === null ? null : JSON.stringify(dados)
      });
    } catch (e) {}
  };

  const abrirGpsExterno = (enderecoDestino) => {
    const query = encodeURIComponent(`${enderecoDestino}, Camanducaia, MG`);
    const url = `https://google.com{query}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Nao foi possivel abrir o GPS.'));
  };

  const buscar = (txt, q) => {
    q === 'O' ? (setOrigem(txt), setSugD([])) : (setDestino(txt), setPreco(null), setSugO([]));
    const f = ruas.filter(r => r.toLowerCase().includes(txt.trim().toLowerCase()));
    q === 'O' ? setSugO(f) : setSugD(f);
  };

  const pedir = () => {
    const id = 'c_' + Date.now();
    setMeuId(id);
    nuvem(id, { id, status: 'BUSCANDO', pass: user.nome, origem, destino, valor: preco, pgto });
  };

  const aceitar = (c) => {
    setMeuId(c.id);
    nuvem(c.id, { ...c, status: 'ANDAMENTO', mot: user.nome, carro, cor, placa: placa.toUpperCase() });
  };

  const finalizar = (c) => {
    const v = parseFloat(c?.valor || 0);
    if (user.tipo === 'MOTORISTA') setGanhos(ganhos + v);
    Alert.alert('Concluida!', `Valor: R$ ${v.toFixed(2)}`);
    nuvem(c.id, null); setMeuId(null); setDestino(''); setPreco(null);
  };

  const entrar = () => nome.trim() ? setUser({ nome, tipo }) : Alert.alert('Aviso', 'Digite seu nome');
  const verPreco = () => destino.trim() ? setPreco((10.0 + destino.length * 0.65).toFixed(2)) : Alert.alert('Aviso', 'Escolha o destino');

  if (!user) return (
    <SafeAreaView style={s.log}>
      <Text style={s.logo}>🚗 MeuApp Uber</Text>
      <Text style={s.sub}>Camanducaia - MG</Text>
      <TextInput style={s.inp} placeholder="Seu nome" value={nome} onChangeText={setNome} />
      <View style={s.row}>
        <TouchableOpacity style={[s.btnT, tipo === 'PASSAGEIRO' && s.atv]} onPress={() => setTipo('PASSAGEIRO')}><Text style={s.b}>🙋‍♂️ Passageiro</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btnT, tipo === 'MOTORISTA' && s.atv]} onPress={() => setTipo('MOTORISTA')}><Text style={s.b}>🚖 Motorista</Text></TouchableOpacity>
      </View>
      {tipo === 'MOTORISTA' && (
        <View style={s.box}>
          <TextInput style={s.inp} placeholder="Modelo" value={carro} onChangeText={setCarro} />
          <View style={s.row}>
            <TextInput style={[s.inp, { flex: 1, marginRight: 4 }]} placeholder="Cor" value={cor} onChangeText={setCor} />
            <TextInput style={[s.inp, { flex: 1, marginLeft: 4 }]} placeholder="Placa" value={placa} onChangeText={setPlaca} />
          </View>
        </View>
      )}
      <TouchableOpacity style={s.btnP} onPress={entrar}><Text style={s.w}>Entrar</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const ativa = meuId ? lista[meuId] : null;
  const fila = Object.values(lista).filter(c => c && c.status === 'BUSCANDO');
  const viaO = (origem.replace(/ - .*/, '') || 'RUA CONEGO CINCINATO CABRAL').toUpperCase();
  const viaD = destino ? destino.replace(/ - .*/, '').toUpperCase() : 'AVENIDA PRESIDENTE VARGAS';

  return (
    <SafeAreaView style={s.cont}>
      <View style={s.top}>
        <View><Text style={s.w}>{user.nome} ({user.tipo})</Text><Text style={s.bdg}>Fila: {fila.length} pedidos</Text></View>
        <TouchableOpacity style={s.btnTr} onPress={() => { setUser(null); setMeuId(null); }}><Text style={s.w}>Sair</Text></TouchableOpacity>
      </View>

      <View style={s.mapa}>
        <View style={s.rio}><Text style={s.rioT}>Rio Camanducaia</Text></View>
        <View style={s.av1}><Text style={s.via} numberOfLines={1}>{viaD}</Text></View>
        <View style={s.av2}><Text style={s.via} numberOfLines={1}>{viaO}</Text></View>
        <View style={s.ruaV}><Text style={s.viaV}>RUA SAO JOSE</Text></View>
        <View style={s.pinO}><View style={s.ptA} /><Text style={s.tag}>GPS</Text></View>
        <Text style={[s.car, ativa?.status === 'ANDAMENTO' ? s.carM : s.carS]}>🚗</Text>
      </View>

      <View style={s.painel}>
        {user.tipo === 'PASSAGEIRO' ? (
          !ativa ? (
            <>
              <Text style={s.tit}>Para onde vamos?</Text>
              <TextInput style={s.inp} value={origem} onFocus={() => buscar('', 'O')} onChangeText={(t) => buscar(t, 'O')} />
              {sugO.length > 0 && <ScrollView style={s.lst} keyboardShouldPersistTaps="always">{sugO.map((r, i) => <TouchableOpacity key={i} style={s.itm} onPress={() => { setOrigem(r); setSugO([]); }}><Text style={s.b}>🔵 {r}</Text></TouchableOpacity>)}</ScrollView>}
              <TextInput style={s.inp} value={destino} onFocus={() => buscar('', 'D')} onChangeText={(t) => buscar(t, 'D')} placeholder="Destino..." />
              {sugD.length > 0 && <ScrollView style={s.lst} keyboardShouldPersistTaps="always">{sugD.map((r, i) => <TouchableOpacity key={i} style={s.itm} onPress={() => { setDestino(r); setSugD([]); setPreco(null); }}><Text style={s.b}>📍 {r}</Text></TouchableOpacity>)}</ScrollView>}
              <View style={s.row}>{['Pix', 'Dinheiro', 'Cartao'].map(p => <TouchableOpacity key={p} style={[s.btnPg, pgto === p && s.atv]} onPress={() => setPgto(p)}><Text style={s.b}>{p}</Text></TouchableOpacity>)}</View>
              {!preco ? <TouchableOpacity style={s.btnP} onPress={verPreco}><Text style={s.w}>Ver Preco</Text></TouchableOpacity> : <TouchableOpacity style={s.btnV} onPress={pedir}><Text style={s.w}>Chamar ({pgto}) R$ {preco}</Text></TouchableOpacity>}
            </>
          ) : ativa.status === 'BUSCANDO' ? (
            <View style={s.ctr}><ActivityIndicator color="#000" /><Text style={s.b}>Aguardando motorista...</Text><TouchableOpacity onPress={() => { nuvem(ativa.id, null); setMeuId(null); }}><Text style={{ color: 'red', marginTop: 8 }}>Cancelar</Text></TouchableOpacity></View>
          ) : (
            <View>
              <View style={s.card}><View><Text style={s.tit}>{ativa.mot} - 4.9★</Text><Text style={s.subC}>{ativa.carro} ({ativa.cor})</Text></View><Text style={s.plc}>{ativa.placa}</Text></View>
              <TouchableOpacity style={s.btnA} onPress={() => finalizar(ativa)}><Text style={s.w}>Concluir (R$ {ativa.valor})</Text></TouchableOpacity>
            </View>
          )
        ) : (
          <>
            <View style={s.rowB}><Text style={s.tit}>Motorista</Text><Switch value={online} onValueChange={setOnline} /></View>
            <Text style={s.gan}>Ganhos: R$ {ganhos.toFixed(2)}</Text>
            {ativa?.status === 'ANDAMENTO' ? (
              <View style={s.alr}>
                <Text style={s.b}>Levando: {ativa.pass}</Text>
                <Text style={s.subC}>Destino: {ativa.destino}</Text>
                <TouchableOpacity style={s.btnGps} onPress={() => abrirGpsExterno(ativa.destino)}><Text style={s.w}>🗺️ Abrir Rota no Google Maps / GPS</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnA} onPress={() => finalizar(ativa)}><Text style={s.w}>Finalizar (+ R$ {ativa.valor})</Text></TouchableOpacity>
              </View>
            ) : online && fila.length > 0 ? (
              <ScrollView style={{ maxHeight: 130 }}>{fila.map(c => <View key={c.id} style={s.alr}><Text style={s.b}>{c.pass} - R$ {c.valor} ({c.pgto})</Text><Text style={s.subC}>{c.destino}</Text><TouchableOpacity style={s.btnV} onPress={() => aceitar(c)}><Text style={s.w}>Aceitar</Text></TouchableOpacity></View>)}</ScrollView>
            ) : <Text style={s.subC}>{online ? 'Aguardando pedidos na fila...' : 'Offline.'}</Text>}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  log: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  logo: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  sub: { textAlign: 'center', color: '#666', marginBottom: 15 },
  box: { backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  cont: { flex: 1, backgroundColor: '#e8eaed' },
top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 12 },
bdg: { color: '#27ae60', fontSize: 11, fontWeight: 'bold' },
btnTr: { backgroundColor: '#333', padding: 8, borderRadius: 6 },
mapa: { flex: 1, backgroundColor: '#e8eaed', overflow: 'hidden' },
rio: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, backgroundColor: '#d2e3fc', alignItems: 'center', justifyContent: 'center' },
rioT: { fontSize: 9, color: '#1967d2', fontWeight: 'bold' },
av1: { position: 'absolute', top: '30%', left: 0, right: 0, height: 22, backgroundColor: '#fff', justifyContent: 'center', paddingLeft: 8 },
av2: { position: 'absolute', top: '68%', left: 0, right: 0, height: 22, backgroundColor: '#fff', justifyContent: 'center', paddingLeft: 8 },
ruaV: { position: 'absolute', top: 0, bottom: 0, left: '68%', width: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
via: { fontSize: 9, fontWeight: 'bold', color: '#5f6368', maxWidth: '64%' },
viaV: { fontSize: 8, fontWeight: 'bold', color: '#5f6368', transform: [{ rotate: '-90deg' }], width: 75, textAlign: 'center' },
pinO: { position: 'absolute', top: '65%', left: '22%', alignItems: 'center' },
ptA: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1a73e8', borderWidth: 2, borderColor: '#fff' },
tag: { backgroundColor: '#fff', fontSize: 9, fontWeight: 'bold', paddingHorizontal: 4, borderRadius: 4 },
car: { position: 'absolute', fontSize: 20 },
carS: { top: '60%', left: '12%' },
carM: { top: '48%', left: '66%' },
painel: { backgroundColor: '#fff', padding: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
tit: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
subC: { fontSize: 12, color: '#555', marginBottom: 4 },
card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 5 },
plc: { backgroundColor: '#eee', padding: 5, borderRadius: 5, borderWidth: 1, fontWeight: 'bold', fontSize: 12 },
inp: { backgroundColor: '#f3f3f3', padding: 8, borderRadius: 8, marginBottom: 6 },
lst: { maxHeight: 90, borderWidth: 1, borderColor: '#bbb', borderRadius: 8, marginBottom: 6 },
itm: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
row: { flexDirection: 'row', marginBottom: 5 },
rowB: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
btnT: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginHorizontal: 2 },
btnPg: { flex: 1, padding: 7, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginHorizontal: 2 },
atv: { borderColor: '#000', borderWidth: 2, backgroundColor: '#eee' },
btnP: { backgroundColor: '#000', padding: 11, borderRadius: 8, alignItems: 'center' },
btnV: { backgroundColor: '#27ae60', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 4 },
btnGps: { backgroundColor: '#1a73e8', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 4 },
btnA: { backgroundColor: '#2980b9', padding: 11, borderRadius: 8, alignItems: 'center', marginTop: 4 },
w: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
b: { fontWeight: 'bold', fontSize: 11 },
ctr: { alignItems: 'center', padding: 10 },
gan: { fontSize: 14, fontWeight: 'bold', color: '#27ae60', marginBottom: 5 },
alr: { backgroundColor: '#fff8e1', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ffe082', marginBottom: 6 }
});