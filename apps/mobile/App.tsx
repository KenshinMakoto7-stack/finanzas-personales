import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, TextInput, Button, FlatList } from "react-native";
import axios from "axios";

const API = "http://localhost:4000"; // ajustar si usas dispositivo físico
const Stack = createNativeStackNavigator();

function Login({ navigation }: any) {
  const [email,setEmail]=useState("ana@example.com");
  const [password,setPassword]=useState("Secreta123");
  async function onLogin() {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
    navigation.replace("Dashboard");
  }
  return (
    <View style={{ padding:16 }}>
      <Text>Login</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Entrar" onPress={onLogin} />
    </View>
  );
}

function Dashboard({ navigation }: any) {
  const [data,setData] = useState<any>();
  useEffect(() => {
    (async ()=>{
      const today = new Date().toISOString().slice(0,10);
      const res = await axios.get(`${API}/dashboard/summary?date=${today}`);
      setData(res.data);
    })();
  }, []);
  return (
    <View style={{ padding:16 }}>
      <Text>Resumen</Text>
      {!data ? <Text>Cargando...</Text> : (
        <>
          <Text>Disponible inicio: {data.budget?.startOfDay?.availableCents / 100}</Text>
          <Text>Promedio hoy: {data.daily?.dailyBudgetCents / 100}</Text>
          <Text>Promedio mañana: {data.daily?.dailyTargetTomorrowCents / 100}</Text>
          <Text>Ingresos mes: {data.month?.totalIncomeCents / 100}</Text>
          <Text>Gastos mes: {data.month?.totalExpenseCents / 100}</Text>
        </>
      )}
      <Button title="Nuevo gasto" onPress={()=>navigation.navigate("NewTx")} />
    </View>
  );
}

function NewTx({ navigation }: any) {
  const [accounts,setAccounts]=useState<any[]>([]);
  const [categories,setCategories]=useState<any[]>([]);
  const [accountId,setAccountId]=useState(""); const [categoryId,setCategoryId]=useState("");
  const [amount,setAmount]=useState("");

  useEffect(()=>{(async()=>{
    const a = await axios.get(`${API}/accounts`); setAccounts(a.data.accounts);
    const c = await axios.get(`${API}/categories?type=EXPENSE`); setCategories(c.data.categories);
  })()},[]);

  async function save() {
    const amountCents = Math.round(Number(amount)*100);
    const occurredAt = new Date().toISOString();
    await axios.post(`${API}/transactions`, { accountId, categoryId, type:"EXPENSE", amountCents, occurredAt });
    navigation.goBack();
  }

  return (
    <View style={{ padding:16 }}>
      <Text>Nuevo Gasto</Text>
      <Text>Cuenta: {accounts[0]?.name} (usa primer ID por simplicidad)</Text>
      {accounts[0] && setAccountId(accounts[0].id)}
      <Text>Categoría: {categories[0]?.name}</Text>
      {categories[0] && setCategoryId(categories[0].id)}
      <TextInput placeholder="Importe (12.34)" value={amount} onChangeText={setAmount}/>
      <Button title="Guardar" onPress={save}/>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={Login}/>
        <Stack.Screen name="Dashboard" component={Dashboard}/>
        <Stack.Screen name="NewTx" component={NewTx}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}



