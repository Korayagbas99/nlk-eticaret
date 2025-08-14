import { loadUserData, saveUserData } from '../utils/userStorage';

export type OrderItem = { name: string; qty: number; price: number };
export type OrderStatus = 'hazirlaniyor' | 'teslim' | 'iptal';
export type Order = { id: string; date: string; status: OrderStatus; items: OrderItem[] };

export type Card = { id: string; brand: string; last4: string; holder?: string };
export type Expense = { id: string; title: string; amount: number; date: string };

const ORDERS = 'orders';
const CARDS = 'cards';
const EXPENSES = 'expenses';

// -------- Orders
export async function listOrders(userId: string): Promise<Order[]> {
  return (await loadUserData<Order[]>(userId, ORDERS)) ?? [];
}

export async function upsertOrder(userId: string, order: Order) {
  const list = await listOrders(userId);
  const ix = list.findIndex(o => o.id === order.id);
  if (ix >= 0) list[ix] = order; else list.unshift(order);
  await saveUserData(userId, ORDERS, list);
}

export async function deleteOrder(userId: string, orderId: string) {
  const list = await listOrders(userId);
  await saveUserData(userId, ORDERS, list.filter(o => o.id !== orderId));
}

// -------- Cards
export async function listCards(userId: string): Promise<Card[]> {
  return (await loadUserData<Card[]>(userId, CARDS)) ?? [];
}

export async function upsertCard(userId: string, card: Card) {
  const list = await listCards(userId);
  const ix = list.findIndex(c => c.id === card.id);
  if (ix >= 0) list[ix] = card; else list.unshift(card);
  await saveUserData(userId, CARDS, list);
}

export async function deleteCard(userId: string, cardId: string) {
  const list = await listCards(userId);
  await saveUserData(userId, CARDS, list.filter(c => c.id !== cardId));
}

// -------- Expenses
export async function listExpenses(userId: string): Promise<Expense[]> {
  return (await loadUserData<Expense[]>(userId, EXPENSES)) ?? [];
}

export async function upsertExpense(userId: string, exp: Expense) {
  const list = await listExpenses(userId);
  const ix = list.findIndex(e => e.id === exp.id);
  if (ix >= 0) list[ix] = exp; else list.unshift(exp);
  await saveUserData(userId, EXPENSES, list);
}

export async function deleteExpense(userId: string, expenseId: string) {
  const list = await listExpenses(userId);
  await saveUserData(userId, EXPENSES, list.filter(e => e.id !== expenseId));
}
