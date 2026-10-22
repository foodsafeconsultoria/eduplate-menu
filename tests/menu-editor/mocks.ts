const now = new Date();
const nutrient = {
  kcal: 100,
  protein: 4,
  lipids: 2,
  carbohydrates: 16,
  fiber: 2,
  calcium: 20,
  iron: 1,
  zinc: 1,
  vitaminA: 20,
  vitaminC: 10,
};
const schools = [
  {
    id: "qa-school",
    name: "Escola de demonstração",
    createdAt: now,
    updatedAt: now,
    mealSchedules: [
      { mealLabel: "Almoço", time: "11:30" },
      { mealLabel: "Lanche", time: "14:00" },
    ],
  },
];
const recipes = [
  {
    id: "qa-recipe",
    name: "Arroz com legumes",
    classification: "principal",
    yieldTotal: 1,
    servings: 10,
    totalGrossWeight: 1100,
    totalNetWeight: 1000,
    perCapita: 0.1,
    costPerServing: 2,
    costTotal: 20,
    usesFamilyFarm: false,
    allergens: [],
    nutrientsPerServing: nutrient,
    ingredients: [{ foodName: "Arroz" }, { foodName: "Cenoura" }],
    createdAt: now,
    updatedAt: now,
  },
];
const user = {
  uid: "qa-user",
  organizationId: "qa-org",
  displayName: "Nutricionista de demonstração",
  role: "nutritionist",
};
export const useAuth = () => ({ user, loading: false });
export const useOrgId = () => user.organizationId;
export const useSchools = () => ({ schools, loading: false });
export const useFoods = () => ({ foods: [], loading: false });
export const useRecipes = () => ({ recipes, loading: false });
export const useSpecialDiets = () => ({ specialDiets: [], loading: false });
export const useOrgSettings = () => ({
  settings: {
    nutritionistName: "Exemplo de RT",
    nutritionistCrn: "DEMONSTRAÇÃO",
  },
  loading: false,
});
export const db = {};
export const auth = { currentUser: { getIdToken: async () => "qa-token" } };
export const doc = (...args) => args.join("/");
export const collection = doc;
export const getDocs = async () => ({ empty: true, docs: [] });
export const deleteDoc = async () => {
  if (window.__qaFailDelete) throw new Error("Falha simulada de exclusão");
};
export const setDoc = async (key, value) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  if (window.__qaFailWrite) throw new Error("Falha simulada de sincronização");
  window.__qaCloudDocs ||= {};
  window.__qaCloudDocs[key] = structuredClone(value);
};
