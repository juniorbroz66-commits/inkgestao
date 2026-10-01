// Fonte inicial do briefing
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const getEnvSafe = (key) => {
  try { return import.meta.env[key] || ""; } catch (e) { return ""; }
};

const firebaseConfig = {
  apiKey: getEnvSafe('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvSafe('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvSafe('VITE_FIREBASE_PROJECT_ID'),
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app, db, firebaseAuthReady = Promise.resolve();
if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    firebaseAuthReady = signInAnonymously(getAuth(app));
  } catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
    firebaseAuthReady = Promise.reject(error);
  }
}

// Ícone vetorial estilizado de uma Plotter de Impressão Colorida
const PlotterLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="8" y="16" width="48" height="28" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="2"/>
    <rect x="12" y="22" width="40" height="12" rx="2" fill="#0f172a"/>
    {/* Cabeçotes de impressão coloridos CMYK */}
    <rect x="20" y="24" width="5" height="8" rx="1" fill="#06b6d4" />
    <rect x="27" y="24" width="5" height="8" rx="1" fill="#ec4899" />
    <rect x="34" y="24" width="5" height="8" rx="1" fill="#eab308" />
    <rect x="41" y="24" width="5" height="8" rx="1" fill="#1e293b" />
    {/* Base e suportes */}
    <path d="M12 44V50C12 51.1046 12.8954 52 14 52H18C19.1046 52 20 51.1046 20 50V44" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
    <path d="M44 44V50C44 51.1046 44.8954 52 46 52H50C51.1046 52 52 51.1046 52 50V44" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
    {/* Folha de impressão saindo */}
    <path d="M18 16L14 8H50L46 16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
  </svg>
);

export default function App() {
  const getStorage = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const [usersList, setUsersList] = useState(() => getStorage('ink_users', [
    { id: '1', name: 'Carlos Alberto (Master)', email: 'juniorbroz66@gmail.com', pass: '809080', role: 'master', status: 'approved', goal: 8000 }
  ]));

  const [transactions, setTransactions] = useState(() => {
    const saved = getStorage('ink_transactions', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [cashRegister, setCashRegister] = useState(() => {
    const saved = getStorage('ink_cash', { openings: [], closings: [], sangrias: [] });
    return {
      openings: Array.isArray(saved?.openings) ? saved.openings : [],
      closings: Array.isArray(saved?.closings) ? saved.closings : [],
      sangrias: Array.isArray(saved?.sangrias) ? saved.sangrias : []
    };
  });

  const [companyGoal, setCompanyGoal] = useState(() => getStorage('ink_cGoal', 25000));
  const [editingOrder, setEditingOrder] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaid, setEditPaid] = useState('');

  const getTodayStr = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split('T')[0];
  };
  const todayStr = getTodayStr();
  const firstDayOfMonthStr = `${todayStr.substring(0, 7)}-01`;

  const [openingDateInput, setOpeningDateInput] = useState(todayStr);
  const [openingAmountInput, setOpeningAmountInput] = useState('');
  const [closingDateInput, setClosingDateInput] = useState(todayStr);
  const [closingAmountInput, setClosingAmountInput] = useState('');

  const [globalStartDate, setGlobalStartDate] = useState(firstDayOfMonthStr);
  const [globalEndDate, setGlobalEndDate] = useState(todayStr);
  const [sangriaStartDate, setSangriaStartDate] = useState(firstDayOfMonthStr);
  const [sangriaEndDate, setSangriaEndDate] = useState(todayStr);

  const [isEditingCompanyGoal, setIsEditingCompanyGoal] = useState(false);
  const [tempCompanyGoal, setTempCompanyGoal] = useState('');
  const [editingUserGoalId, setEditingUserGoalId] = useState(null);
  const [tempUserGoalVal, setTempUserGoalVal] = useState('');

  // Estados para edição completa de conta (Recuperação / Senha esquecida pelo Master)
  const [editingAccountUserId, setEditingAccountUserId] = useState(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccEmail, setEditAccEmail] = useState('');
  const [editAccPass, setEditAccPass] = useState('');

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!db) return;
    let active = true;
    let unsubscribers = [];
    firebaseAuthReady.then(() => {
      if (!active) return;
      const unsubTransactions = onSnapshot(collection(db, "transactions"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTransactions(data);
      });
      const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) setUsersList(data);
      });
      const unsubCash = onSnapshot(doc(db, "cashControl", "general"), (docSnap) => {
        if (docSnap.exists()) setCashRegister(docSnap.data());
      });
      const unsubGoals = onSnapshot(doc(db, "settings", "goals"), (docSnap) => {
        if (docSnap.exists()) {
          const gData = docSnap.data();
          if (gData.companyGoal) setCompanyGoal(gData.companyGoal);
        }
      });
      unsubscribers = [unsubTransactions, unsubUsers, unsubCash, unsubGoals];
    }).catch((error) => console.error("Erro na autenticação Firebase:", error));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      localStorage.setItem('ink_users', JSON.stringify(usersList));
      localStorage.setItem('ink_transactions', JSON.stringify(transactions));
      localStorage.setItem('ink_cash', JSON.stringify(cashRegister));
      localStorage.setItem('ink_cGoal', JSON.stringify(companyGoal));
    }
  }, [usersList, transactions, cashRegister, companyGoal]);

  const saveTransaction = async (newTransaction) => {
    if (db) {
      try { await setDoc(doc(db, "transactions", newTransaction.id), { ...newTransaction, createdAt: Date.now() }); } 
      catch (err) { console.error(err); }
    } else { setTransactions(prev => [newTransaction, ...prev]); }
  };

  const updateTransaction = async (id, updatedFields) => {
    if (db) {
      try { await updateDoc(doc(db, "transactions", id), updatedFields); } 
      catch (err) { console.error(err); }
    } else { setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t)); }
  };

  const saveCashRegister = async (newCashObj) => {
    if (db) {
      try { await setDoc(doc(db, "cashControl", "general"), newCashObj); } 
      catch (err) { console.error(err); }
    } else { setCashRegister(newCashObj); }
  };

  const saveUser = async (newUser) => {
    if (db) {
      try { await setDoc(doc(db, "users", newUser.id), newUser); } 
      catch (err) { console.error(err); }
    } else { setUsersList(prev => [...prev, newUser]); }
  };

  const updateUserField = async (userId, fieldsObj) => {
    if (db) {
      try { await updateDoc(doc(db, "users", userId), fieldsObj); } 
      catch (err) { console.error(err); }
    } else {
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, ...fieldsObj } : u));
    }
  };

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  const [formType, setFormType] = useState('entry');
  const [formClientType, setFormClientType] = useState('final');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaid, setFormPaid] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('PIX');
  const [formIsPresential, setFormIsPresential] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyUserFilter, setHistoryUserFilter] = useState('');
  const [historyOnlyPending, setHistoryOnlyPending] = useState(false);

  const nextOrderNumber = useMemo(() => {
    const numbers = transactions
      .map(t => { const match = t.orderNo && t.orderNo.match(/\d+/); return match ? parseInt(match[0], 10) : 0; })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    return `OS-${maxNum + 1}`;
  }, [transactions]);

  const historyUserOptions = useMemo(() => {
    const names = [...usersList.map(u => u.name), ...transactions.map(t => t.user)].filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [usersList, transactions]);

  const filteredHistoryTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return transactions.filter(t => {
      const paidVal = t.paidAmount !== undefined ? Number(t.paidAmount) : Number(t.amount);
      const pendingVal = Number(t.amount) - paidVal;
      const matchesSearch = !query || (t.desc || '').toLowerCase().includes(query) || (t.orderNo || '').toLowerCase().includes(query) || (t.user || '').toLowerCase().includes(query);
      const matchesStartDate = !historyStartDate || t.date >= historyStartDate;
      const matchesEndDate = !historyEndDate || t.date <= historyEndDate;
      const matchesUser = !historyUserFilter || t.user === historyUserFilter;
      const matchesPending = !historyOnlyPending || (t.type === 'entry' && pendingVal > 0.009);
      return matchesSearch && matchesStartDate && matchesEndDate && matchesUser && matchesPending;
    });
  }, [transactions, searchTerm, historyStartDate, historyEndDate, historyUserFilter, historyOnlyPending]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginEmail.trim().toLowerCase() === 'juniorbroz66@gmail.com' && loginPass === '809080') {
      const masterUser = { id: 'master_1', name: 'Carlos Alberto (Master)', email: loginEmail, role: 'master', status: 'approved', goal: 8000 };
      setCurrentUser(masterUser);
      return;
    }
    const found = usersList.find(u => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.pass === loginPass);
    if (!found) { alert('E-mail ou senha incorretos.'); return; }
    if (found.status !== 'approved') { alert('Seu cadastro está aguardando aprovação de um Administrador Master.'); return; }
    setCurrentUser(found);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPass) { alert('Preencha todos os campos.'); return; }
    if (usersList.some(u => u.email.toLowerCase() === regEmail.toLowerCase())) { alert('Este e-mail já está cadastrado!'); return; }
    
    const isMasterRequest = regEmail.trim().toLowerCase() === 'juniorbroz66@gmail.com';
    const newUser = {
      id: Date.now().toString(), name: regName, email: regEmail, pass: regPass,
      role: isMasterRequest ? 'master' : 'user', status: isMasterRequest ? 'approved' : 'pending', goal: 8000
    };
    
    saveUser(newUser);
    if (isMasterRequest) { setCurrentUser(newUser); } 
    else {
      alert('Cadastro realizado com sucesso! Aguarde a aprovação do Administrador.');
      setIsRegistering(false); setRegName(''); setRegEmail(''); setRegPass('');
    }
  };

  const handlePasswordRecovery = (e) => {
    e.preventDefault();
    const email = recoveryEmail.trim().toLowerCase();
    const isMasterEmail = email === 'juniorbroz66@gmail.com';
    const found = usersList.find(u => u.email.toLowerCase() === email);
    if (!found && !isMasterEmail) {
      setRecoveryMessage('Não encontramos um cadastro com esse e-mail. Confira o endereço e tente novamente.');
      return;
    }
    const password = isMasterEmail ? '809080' : found.pass;
    setRecoveryMessage(`Senha atual: ${password}`);
  };

  const handlePrint = (e) => {
    if (e) e.preventDefault();
    setTimeout(() => window.print(), 150);
  };

  const filteredTransactionsByDate = useMemo(() => {
    return transactions.filter(t => t.status !== 'cancelled' && t.date >= globalStartDate && t.date <= globalEndDate);
  }, [transactions, globalStartDate, globalEndDate]);

  const totalEntries = useMemo(() => filteredTransactionsByDate.filter(t => t.type === 'entry').reduce((acc, t) => acc + t.amount, 0), [filteredTransactionsByDate]);
  const totalExpenses = useMemo(() => filteredTransactionsByDate.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0), [filteredTransactionsByDate]);
  const netBalance = totalEntries - totalExpenses;

  const totalFinalClient = useMemo(() => filteredTransactionsByDate.filter(t => t.type === 'entry' && t.clientType === 'final').reduce((acc, t) => acc + t.amount, 0), [filteredTransactionsByDate]);
  const totalThirdClient = useMemo(() => filteredTransactionsByDate.filter(t => t.type === 'entry' && t.clientType === 'third').reduce((acc, t) => acc + t.amount, 0), [filteredTransactionsByDate]);

  const userTotalEntries = useMemo(() => {
    if (!currentUser) return 0;
    return filteredTransactionsByDate.filter(t => t.type === 'entry' && t.user === currentUser.name).reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactionsByDate, currentUser]);

  const currentUserGoal = useMemo(() => {
    if (!currentUser) return 8000;
    const foundU = usersList.find(u => u.id === currentUser.id || u.email === currentUser.email);
    return foundU?.goal !== undefined ? foundU.goal : 8000;
  }, [usersList, currentUser]);

  const chartData = [
    { name: 'Cliente Final', valor: totalFinalClient },
    { name: 'Terceirizado', valor: totalThirdClient }
  ];

  const filteredSangrias = useMemo(() => {
    return cashRegister.sangrias.filter(s => {
      const sDate = s.date || todayStr;
      return sDate >= sangriaStartDate && sDate <= sangriaEndDate;
    });
  }, [cashRegister.sangrias, sangriaStartDate, sangriaEndDate, todayStr]);

  const totalSangriasFiltradas = useMemo(() => filteredSangrias.reduce((acc, s) => acc + s.amount, 0), [filteredSangrias]);

  const cashReportData = useMemo(() => {
    const totalOpenings = cashRegister.openings.reduce((acc, o) => acc + o.amount, 0);
    const totalClosings = cashRegister.closings.reduce((acc, c) => acc + c.amount, 0);
    const balance = totalClosings - totalOpenings;
    return { totalOpenings, totalClosings, balance };
  }, [cashRegister]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="bg-slate-800 border border-slate-700 w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 border border-slate-700 rounded-2xl mb-3 shadow-lg">
              <PlotterLogo className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">INKGestão</h1>
            <p className="text-sm text-slate-400 mt-1">Gestão e Finanças</p>
            {isFirebaseConfigured ? (
              <span className="inline-block mt-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">● Firestore conectado</span>
            ) : (
              <span className="inline-block mt-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">● Offline (Local)</span>
            )}
          </div>

          {isRecoveringPassword ? (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Recuperar senha</h2>
                <p className="text-xs text-slate-400 mt-1">Informe o e-mail usado no cadastro para visualizar sua senha atual.</p>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">E-mail de cadastro</label>
                <input type="email" required value={recoveryEmail} onChange={(e) => { setRecoveryEmail(e.target.value); setRecoveryMessage(''); }} placeholder="usuario@gmail.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-600/25">Revelar senha atual</button>
              {recoveryMessage && <p className={`text-sm font-semibold rounded-lg p-3 ${recoveryMessage.startsWith('Não') ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{recoveryMessage}</p>}
              <div className="text-center pt-2">
                <button type="button" onClick={() => { setIsRecoveringPassword(false); setRecoveryMessage(''); }} className="text-xs text-slate-400 hover:underline">Voltar para o login</button>
              </div>
            </form>
          ) : !isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">E-mail</label>
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="usuario@gmail.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Senha</label>
                <input type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-600/25">Entrar no Sistema</button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => { setIsRecoveringPassword(true); setRecoveryEmail(loginEmail); setRecoveryMessage(''); }} className="text-xs text-blue-400 hover:underline">Esqueci minha senha</button>
              </div>
              <div className="text-center">
                <button type="button" onClick={() => setIsRegistering(true)} className="text-xs text-blue-400 hover:underline">Primeiro acesso? Solicite seu cadastro</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Nome Completo</label>
                <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Seu Nome" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">E-mail</label>
                <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="usuario@gmail.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Senha</label>
                <input type="password" required value={regPass} onChange={(e) => setRegPass(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-3 rounded-lg transition shadow-lg shadow-emerald-600/25">Solicitar Acesso</button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => setIsRegistering(false)} className="text-xs text-slate-400 hover:underline">Já tem uma conta? Faça login</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row print:bg-white print:h-auto print:block print:min-h-0">
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-6 shadow-xl print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 shadow-md">
              <PlotterLogo className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg tracking-wide">INKGestão</h2>
              <span className="text-xs text-slate-400">Comunicação Visual</span>
            </div>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>📊 Visão Geral</button>
            <button onClick={() => setActiveTab('transactions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'transactions' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>💰 Lançamentos & Vendas</button>
            {currentUser.role === 'master' && (
              <button onClick={() => setActiveTab('cash')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>💵 Controle de Caixa</button>
            )}
            <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>📈 Relatórios Automáticos</button>
            <button onClick={() => setActiveTab('pdf')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'pdf' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>🖨️ Relatórios PDF</button>
            {currentUser.role === 'master' && (
              <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'team' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>👥 Equipe (Master)</button>
            )}
          </nav>
        </div>
        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-white font-semibold">{currentUser.name}</p>
              <span className="text-[10px] uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">{currentUser.role}</span>
            </div>
          </div>
          <button onClick={() => setCurrentUser(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg transition">Sair da Conta</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto print:overflow-visible print:h-auto print:block print:p-0 print:m-0">
        
        {activeTab === 'overview' && (
          <div className="space-y-6 print:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard Financeiro</h1>
                <p className="text-sm text-slate-500 print:hidden">Acompanhe as entradas, saídas e desempenho geral filtrado por período.</p>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm print:hidden">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold">Data Inicial</label>
                  <input type="date" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold">Data Final</label>
                  <input type="date" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-medium" />
                </div>
                <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg ml-2 font-medium">🖨️ Imprimir</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Faturamento (Período)</span>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">R$ {totalEntries.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Saídas / Despesas</span>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suas Vendas no Período</span>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">R$ {userTotalEntries.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-slate-800">Meta Faturamento da Empresa</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold">Meta: R$ {companyGoal.toLocaleString('pt-BR')}</span>
                    {currentUser.role === 'master' && !isEditingCompanyGoal && (
                      <button onClick={() => { setIsEditingCompanyGoal(true); setTempCompanyGoal(companyGoal.toString()); }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded">Editar</button>
                    )}
                  </div>
                </div>
                {isEditingCompanyGoal ? (
                  <div className="flex gap-2 my-2">
                    <input type="number" value={tempCompanyGoal} onChange={(e) => setTempCompanyGoal(e.target.value)} className="bg-slate-50 border border-slate-300 rounded px-3 py-1 text-sm w-full" />
                    <button onClick={() => { 
                      const val = parseFloat(tempCompanyGoal); 
                      if (val > 0) {
                        setCompanyGoal(val);
                        if (db) setDoc(doc(db, "settings", "goals"), { companyGoal: val }, { merge: true });
                      }
                      setIsEditingCompanyGoal(false); 
                    }} className="bg-blue-600 text-white text-xs px-3 py-1 rounded">Salvar</button>
                  </div>
                ) : null}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mt-3">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalEntries / companyGoal) * 100)}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Alcançado: {((totalEntries / companyGoal) * 100).toFixed(1)}% do objetivo</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-slate-800">Sua Meta Individual ({currentUser.name})</h3>
                  <span className="text-xs text-slate-500 font-bold">Meta: R$ {currentUserGoal.toLocaleString('pt-BR')}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mt-3">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (userTotalEntries / currentUserGoal) * 100)}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Alcançado: {((userTotalEntries / currentUserGoal) * 100).toFixed(1)}% da meta</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <h3 className="font-semibold text-slate-800 mb-4">Divisão de Faturamento por Cliente</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip formatter={(val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Lançamentos & Vendas</h1>
                <p className="text-sm text-slate-500 print:hidden">Informe o valor total do pedido e o valor efetivamente pago pelo cliente.</p>
              </div>
              <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2.5 rounded-xl font-medium print:hidden">🖨️ Imprimir</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 print:hidden">
                <h3 className="font-semibold text-slate-800 mb-4">Novo Lançamento</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!formDesc || !formAmount) return;
                  const totalVal = parseFloat(formAmount);
                  const paidVal = formPaid !== '' ? parseFloat(formPaid) : totalVal;
                  const newT = {
                    id: Date.now().toString(), type: formType, clientType: formClientType, desc: formDesc, 
                    amount: totalVal, paidAmount: paidVal, date: todayStr, user: currentUser.name, orderNo: nextOrderNumber, 
                    paymentMethod: formPaymentMethod, isPresential: formIsPresential, status: 'active'
                  };
                  saveTransaction(newT);
                  setFormDesc(''); setFormAmount(''); setFormPaid('');
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Tipo</label>
                    <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
                      <option value="entry">Entrada (Receita / Venda)</option>
                      <option value="expense">Saída (Despesa / Compra)</option>
                    </select>
                  </div>
                  {formType === 'entry' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Perfil do Cliente</label>
                        <select value={formClientType} onChange={(e) => setFormClientType(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
                          <option value="final">Cliente Final</option>
                          <option value="third">Cliente Terceirizado</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input type="checkbox" id="presential" checked={formIsPresential} onChange={(e) => setFormIsPresential(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        <label htmlFor="presential" className="text-sm text-slate-700 font-medium">Venda Presencial / Balcão</label>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nº do Pedido</label>
                    <input type="text" disabled value={nextOrderNumber} className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-sm font-mono font-bold text-slate-600 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Descrição</label>
                    <input type="text" required value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Ex: Lona Fachada" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valor Total do Pedido (R$)</label>
                    <input type="number" step="0.01" required value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0,00" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-emerald-700" />
                  </div>
                  {formType === 'entry' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valor Pago (Parcial ou Total)</label>
                      <input type="number" step="0.01" value={formPaid} onChange={(e) => setFormPaid(e.target.value)} placeholder="Deixe vazio se pago integral" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm" />
                      <span className="text-[10px] text-slate-400 mt-1 block">Se parcial, o restante fica pendente para a retirada. Apenas o total entra no relatório.</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Pagamento</label>
                    <select value={formPaymentMethod} onChange={(e) => setFormPaymentMethod(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
                      <option value="Dinheiro">Dinheiro (Espécie)</option>
                      <option value="PIX">PIX</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Boleto">Boleto</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-semibold py-2.5 rounded-lg text-sm text-white shadow-md">Registrar Lançamento</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 print:col-span-3 print:shadow-none print:border-none print:p-0">
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-800">Histórico de Pedidos e Lançamentos</h3>
                      <p className="text-xs text-slate-400 mt-1 print:hidden">Use os filtros para localizar pedidos por período, usuário ou saldo pendente.</p>
                    </div>
                    <input type="text" placeholder="Buscar por OS, descrição ou usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-full sm:w-72 print:hidden" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 print:hidden">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Data inicial</label>
                      <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Data final</label>
                      <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Usuário</label>
                      <select value={historyUserFilter} onChange={(e) => setHistoryUserFilter(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
                        <option value="">Todos os usuários</option>
                        {historyUserOptions.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-4 sm:pt-0 lg:pt-4">
                      <input type="checkbox" checked={historyOnlyPending} onChange={(e) => setHistoryOnlyPending(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                      Somente resta a pagar
                    </label>
                    <button type="button" onClick={() => { setSearchTerm(''); setHistoryStartDate(''); setHistoryEndDate(''); setHistoryUserFilter(''); setHistoryOnlyPending(false); }} className="self-end bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold">Limpar filtros</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase print:text-black">
                        <th className="py-3 px-2">Nº OS</th><th className="py-3 px-2">Descrição</th><th className="py-3 px-2">Vendedor</th><th className="py-3 px-2">Valores (Pago / Total)</th><th className="py-3 px-2 text-right print:hidden">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredHistoryTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-sm text-slate-400">Nenhum pedido encontrado com os filtros selecionados.</td>
                        </tr>
                      ) : filteredHistoryTransactions.map(t => {
                          const isCancelled = t.status === 'cancelled';
                          const isEditing = editingOrder === t.id;
                          const paidVal = t.paidAmount !== undefined ? t.paidAmount : t.amount;
                          const pendingVal = t.amount - paidVal;

                          return (
                            <tr key={t.id} className={`hover:bg-slate-50/80 ${isCancelled ? 'opacity-50 bg-slate-100 print:hidden' : ''}`}>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded font-bold text-slate-700 print:bg-transparent print:p-0">{t.orderNo}</span>
                                <div className="text-[11px] text-slate-400 mt-0.5">{t.date}</div>
                              </td>
                              <td className="py-3 px-2 font-medium text-slate-700">
                                {isEditing ? (
                                  <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="border border-blue-400 rounded px-2 py-1 text-xs w-full" />
                                ) : (
                                  <><span className={isCancelled ? 'line-through text-slate-400' : ''}>{t.desc}</span>{t.isPresential && !isCancelled && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded print:hidden">Balcão</span>}</>
                                )}
                              </td>
                              <td className="py-3 px-2 text-slate-500 text-xs">{t.user}</td>
                              <td className="py-3 px-2">
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="border border-blue-400 rounded px-1 py-1 text-xs w-20" placeholder="Total" />
                                    <input type="number" step="0.01" value={editPaid} onChange={(e) => setEditPaid(e.target.value)} className="border border-blue-400 rounded px-1 py-1 text-xs w-20" placeholder="Pago" />
                                  </div>
                                ) : (
                                  <div>
                                    <span className={`font-semibold ${isCancelled ? 'text-slate-400 line-through' : t.type === 'entry' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {t.type === 'entry' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {t.type === 'entry' && paidVal < t.amount && (
                                      <div className="text-[11px] text-amber-600 font-medium">
                                        Pago: R$ {paidVal.toFixed(2)} | Resta: R$ {pendingVal.toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isCancelled && (isEditing ? (
                                      <><button onClick={() => { 
                                        const amt = parseFloat(editAmount); 
                                        const pd = editPaid !== '' ? parseFloat(editPaid) : amt;
                                        if (!editDesc || isNaN(amt)) return; 
                                        updateTransaction(t.id, { desc: editDesc, amount: amt, paidAmount: pd }); 
                                        setEditingOrder(null); 
                                      }} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">Salvar</button><button onClick={() => setEditingOrder(null)} className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs">X</button></>
                                    ) : (<button onClick={() => { setEditingOrder(t.id); setEditDesc(t.desc); setEditAmount(t.amount.toString()); setEditPaid((t.paidAmount !== undefined ? t.paidAmount : t.amount).toString()); }} className="bg-slate-100 p-1.5 rounded-lg text-xs">✏️</button>)
                                  )}
                                  {!isCancelled && (<button onClick={() => { if (window.confirm('Cancelar este pedido?')) updateTransaction(t.id, { status: 'cancelled' }); }} className="text-rose-600 border border-rose-200 px-2 py-1 rounded-lg text-xs">Cancelar</button>)}
                                </div>
                              </td>
                            </tr>
                          );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cash' && currentUser.role === 'master' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Controle de Caixa</h1>
                <p className="text-sm text-slate-500 print:hidden">Abertura, fechamento e sangrias totalmente isoladas.</p>
              </div>
              <button onClick={handlePrint} className="bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl print:hidden">🖨️ Imprimir</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Valor Inicial (Abertura)</span>
                    {cashRegister.openings.some(o => o.date === openingDateInput) && (
                      <button type="button" onClick={() => setOpeningAmountInput((cashRegister.openings.find(o => o.date === openingDateInput)?.amount || 0).toString())} className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded">Editar</button>
                    )}
                  </div>
                  <input type="date" value={openingDateInput} onChange={(e) => { setOpeningDateInput(e.target.value); setOpeningAmountInput(''); }} className="bg-slate-50 border rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex gap-2">
                  <input type="number" step="0.01" value={openingAmountInput} onChange={(e) => setOpeningAmountInput(e.target.value)} placeholder="0.00" className="border rounded-lg px-3 py-2 text-sm w-full" />
                  <button onClick={() => {
                    const val = parseFloat(openingAmountInput); if (isNaN(val)) return;
                    const existingIndex = cashRegister.openings.findIndex(o => o.date === openingDateInput);
                    let newOpenings = [...cashRegister.openings];
                    if (existingIndex >= 0) newOpenings[existingIndex].amount = val;
                    else newOpenings.push({ id: Date.now().toString(), date: openingDateInput, amount: val });
                    saveCashRegister({ ...cashRegister, openings: newOpenings });
                    setOpeningAmountInput('');
                  }} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg">{cashRegister.openings.some(o => o.date === openingDateInput) ? 'Atualizar' : 'Salvar'}</button>
                </div>
                <p className="text-xs text-slate-400">No dia {openingDateInput}: <b>R$ {(cashRegister.openings.find(o => o.date === openingDateInput)?.amount || 0).toFixed(2)}</b></p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Valor Final (Fechamento)</span>
                    {cashRegister.closings.some(c => c.date === closingDateInput) && (
                      <button type="button" onClick={() => setClosingAmountInput((cashRegister.closings.find(c => c.date === closingDateInput)?.amount || 0).toString())} className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded">Editar</button>
                    )}
                  </div>
                  <input type="date" value={closingDateInput} onChange={(e) => { setClosingDateInput(e.target.value); setClosingAmountInput(''); }} className="bg-slate-50 border rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex gap-2">
                  <input type="number" step="0.01" value={closingAmountInput} onChange={(e) => setClosingAmountInput(e.target.value)} placeholder="0.00" className="border rounded-lg px-3 py-2 text-sm w-full" />
                  <button onClick={() => {
                    const val = parseFloat(closingAmountInput); if (isNaN(val)) return;
                    const existingIndex = cashRegister.closings.findIndex(c => c.date === closingDateInput);
                    let newClosings = [...cashRegister.closings];
                    if (existingIndex >= 0) newClosings[existingIndex].amount = val;
                    else newClosings.push({ id: Date.now().toString(), date: closingDateInput, amount: val });
                    saveCashRegister({ ...cashRegister, closings: newClosings });
                    setClosingAmountInput('');
                  }} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg">{cashRegister.closings.some(c => c.date === closingDateInput) ? 'Atualizar' : 'Salvar'}</button>
                </div>
                <p className="text-xs text-slate-400">No dia {closingDateInput}: <b>R$ {(cashRegister.closings.find(c => c.date === closingDateInput)?.amount || 0).toFixed(2)}</b></p>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${
              cashReportData.balance >= 0 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50/80 border-rose-200 text-rose-900'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Relatório Acoplado do Caixa (Aberturas vs Fechamentos)</h3>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  cashReportData.balance >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {cashReportData.balance >= 0 ? 'Resultado Positivo' : 'Resultado Negativo'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/80 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 uppercase block">Total Aberturas</span>
                  <span className="font-bold text-slate-700">R$ {cashReportData.totalOpenings.toFixed(2)}</span>
                </div>
                <div className="bg-white/80 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 uppercase block">Total Fechamentos</span>
                  <span className="font-bold text-slate-700">R$ {cashReportData.totalClosings.toFixed(2)}</span>
                </div>
                <div className={`p-3 rounded-xl border font-bold flex flex-col justify-center ${
                  cashReportData.balance >= 0 ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-rose-600 text-white border-rose-700'
                }`}>
                  <span className="text-xs uppercase opacity-80">Balanço Líquido de Caixa</span>
                  <span className="text-lg">R$ {cashReportData.balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <h3 className="font-semibold text-slate-800 mb-4">Registrar Nova Sangria</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const desc = e.target.elements.sDesc.value; const amt = parseFloat(e.target.elements.sAmt.value);
                if (!desc || !amt) return;
                saveCashRegister({ ...cashRegister, sangrias: [...cashRegister.sangrias, { id: Date.now().toString(), desc, amount: amt, date: todayStr }] });
                e.target.reset();
              }} className="flex gap-3">
                <input type="text" name="sDesc" placeholder="Motivo da retirada" required className="flex-1 border rounded-lg p-2 text-sm" />
                <input type="number" step="0.01" name="sAmt" placeholder="Valor R$" required className="w-32 border rounded-lg p-2 text-sm" />
                <button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm transition">Registrar</button>
              </form>
            </div>

            {/* SEÇÃO DE SANGRIA ISOLADA — último relatório da página */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 print:border-slate-300 print:shadow-none">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-4 gap-4">
                <div>
                  <h3 className="font-semibold text-slate-800">Relatório Isolado de Sangrias (Retiradas para o Cofre)</h3>
                  <p className="text-2xl font-bold text-rose-600 mt-1">R$ {totalSangriasFiltradas.toFixed(2)}</p>
                  <span className="text-[11px] text-slate-400">Este valor está separado e não interfere na abertura/fechamento do caixa.</span>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <input type="date" value={sangriaStartDate} onChange={(e) => setSangriaStartDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
                  <input type="date" value={sangriaEndDate} onChange={(e) => setSangriaEndDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
                  <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg ml-2 transition">🖨️ Imprimir</button>
                </div>
              </div>
              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {filteredSangrias.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma sangria registrada no período.</p>
                ) : (
                  filteredSangrias.map(s => (
                    <div key={s.id} className="flex justify-between bg-slate-50 p-3 rounded-lg border print:border-slate-300">
                      <div><span className="font-medium">{s.desc}</span><div className="text-xs text-slate-400">{s.date}</div></div>
                      <span className="font-semibold text-rose-600">- R$ {s.amount.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6 print:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Relatórios Demonstrativos</h1>
                <p className="text-sm text-slate-500 print:hidden">Balanços financeiros filtrados por período livre.</p>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm print:hidden">
                <input type="date" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} className="bg-slate-50 border rounded px-2 py-1 text-xs" />
                <input type="date" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} className="bg-slate-50 border rounded px-2 py-1 text-xs" />
                <button onClick={handlePrint} className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg ml-2">🖨️ Imprimir</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border shadow-sm print:border-slate-300 print:shadow-none">
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Resumo do Período</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-3">R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                <div className="mt-4 pt-4 border-t flex justify-between text-xs text-slate-500">
                  <span>Entradas: R$ {totalEntries.toLocaleString('pt-BR')}</span><span>Saídas: R$ {totalExpenses.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm print:border-slate-300 print:shadow-none">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Volume de Pedidos</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-3">{filteredTransactionsByDate.length} Lançamentos</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm print:border-slate-300 print:shadow-none">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Média Diária</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-3">R$ {(() => {
                  const days = Math.max(1, Math.round((new Date(globalEndDate) - new Date(globalStartDate)) / (1000 * 60 * 60 * 24)) + 1);
                  return (totalEntries / days).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                })()}</h3>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pdf' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
              <h1 className="text-2xl font-bold text-slate-900">Relatórios para Impressão (PDF)</h1>
              <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">🖨️ Imprimir / Salvar PDF</button>
            </div>
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between print:hidden">
              <span className="text-sm font-semibold">Selecione o Intervalo:</span>
              <div className="flex items-center gap-2">
                <input type="date" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
                <input type="date" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border shadow-sm space-y-6 print:border-none print:p-0 print:shadow-none">
              <div className="border-b pb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">INKGestão - Relatório Financeiro</h2>
                  <p className="text-xs text-slate-500 mt-1">Período: {globalStartDate} até {globalEndDate} | Emitido por: {currentUser.name}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-blue-600">INKGESTÃO PARTNER</span>
                  <p className="text-xs text-slate-400">Comunicação Visual</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-xs uppercase font-semibold">Entradas</span><p className="text-lg font-bold text-emerald-600">R$ {totalEntries.toFixed(2)}</p></div>
                <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-xs uppercase font-semibold">Saídas</span><p className="text-lg font-bold text-rose-600">R$ {totalExpenses.toFixed(2)}</p></div>
                <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-xs uppercase font-semibold">Balanço</span><p className="text-lg font-bold text-blue-600">R$ {netBalance.toFixed(2)}</p></div>
              </div>
              <div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-xs text-slate-400 uppercase">
                      <th className="py-2">Nº OS</th><th className="py-2">Descrição</th><th className="py-2">Vendedor</th><th className="py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactionsByDate.map(t => (
                      <tr key={t.id}>
                        <td className="py-2 font-mono text-xs">{t.orderNo}</td><td className="py-2">{t.desc}</td><td className="py-2 text-xs">{t.user}</td>
                        <td className={`py-2 text-right font-semibold ${t.type === 'entry' ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {t.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && currentUser.role === 'master' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Equipe, Metas & Contas</h1>
              <p className="text-sm text-slate-500">Aprove cadastros, defina metas e edite dados de acesso (recuperação de senha).</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="divide-y divide-slate-100">
                {usersList.map(u => {
                  const uGoal = u.goal !== undefined ? u.goal : 8000;
                  const isEditingThisGoal = editingUserGoalId === u.id;
                  const isEditingThisAccount = editingAccountUserId === u.id;

                  return (
                    <div key={u.id} className="py-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{u.name}</span>
                            <span className="text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{u.role}</span>
                          </div>
                          <span className="text-xs text-slate-400">{u.email}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Bloco de Meta */}
                          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Meta Individual</span>
                            {isEditingThisGoal ? (
                              <div className="flex gap-1 mt-1">
                                <input type="number" value={tempUserGoalVal} onChange={(e) => setTempUserGoalVal(e.target.value)} className="border rounded px-2 py-0.5 text-xs w-24" />
                                <button onClick={() => {
                                  const val = parseFloat(tempUserGoalVal);
                                  if (!isNaN(val)) updateUserField(u.id, { goal: val });
                                  setEditingUserGoalId(null);
                                }} className="bg-emerald-600 text-white px-2 py-0.5 rounded text-xs">OK</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700">R$ {uGoal.toLocaleString('pt-BR')}</span>
                                <button onClick={() => { setEditingUserGoalId(u.id); setTempUserGoalVal(uGoal.toString()); }} className="text-blue-600 hover:underline text-[11px]">Editar</button>
                              </div>
                            )}
                          </div>

                          {/* Botão para editar o cadastro completo */}
                          <button onClick={() => {
                            if (isEditingThisAccount) {
                              setEditingAccountUserId(null);
                            } else {
                              setEditingAccountUserId(u.id);
                              setEditAccName(u.name);
                              setEditAccEmail(u.email);
                              setEditAccPass(u.pass);
                            }
                          }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-medium transition">
                            {isEditingThisAccount ? 'Fechar Edição' : '✏️ Editar Cadastro'}
                          </button>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-bold ${u.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {u.status === 'approved' ? 'Aprovado' : 'Pendente'}
                            </span>
                            {u.status === 'pending' && (
                              <button onClick={() => updateUserField(u.id, { status: 'approved' })} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium">Aprovar</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Caixa de formulário para editar Nome, E-mail e senha */}
                      {isEditingThisAccount && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-blue-200 space-y-3 mt-2">
                          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Editar cadastro e dados de acesso</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nome</label>
                              <input type="text" value={editAccName} onChange={(e) => setEditAccName(e.target.value)} className="w-full bg-white border rounded px-2.5 py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">E-mail</label>
                              <input type="email" value={editAccEmail} onChange={(e) => setEditAccEmail(e.target.value)} className="w-full bg-white border rounded px-2.5 py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nova Senha</label>
                              <input type="password" value={editAccPass} onChange={(e) => setEditAccPass(e.target.value)} className="w-full bg-white border rounded px-2.5 py-1.5 text-xs" placeholder="Nova senha" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setEditingAccountUserId(null)} className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded">Cancelar</button>
                            <button onClick={() => {
                              if (!editAccName || !editAccEmail || !editAccPass) { alert('Preencha todos os campos!'); return; }
                              const emailAlreadyUsed = usersList.some(other => other.id !== u.id && other.email.toLowerCase() === editAccEmail.trim().toLowerCase());
                              if (emailAlreadyUsed) { alert('Este e-mail já está sendo usado por outro cadastro.'); return; }
                              updateUserField(u.id, { name: editAccName.trim(), email: editAccEmail.trim(), pass: editAccPass });
                              if (currentUser.id === u.id || currentUser.email === u.email) setCurrentUser(prev => ({ ...prev, name: editAccName.trim(), email: editAccEmail.trim(), pass: editAccPass }));
                              setEditingAccountUserId(null);
                            }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-1.5 rounded font-semibold">Salvar Alterações</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
