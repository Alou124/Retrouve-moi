// ============================================
// CONFIGURATION SUPABASE
// ============================================
// Remplace ces valeurs par celles de ton projet Supabase
// (Dashboard Supabase > Project Settings > API)

const SUPABASE_URL = "https://zjrqkapwfnecknerfbpo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bHBvvBzISW1dpfahtdzzxQ_p4lTzzZF";

// Le SDK Supabase est chargé via CDN dans le <head> de chaque page :
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================================
// SÉCURITÉ
// ============================================

// Neutralise tout code HTML/JS qu'un utilisateur aurait pu glisser dans un titre,
// une description, etc. À utiliser PARTOUT où du contenu utilisateur est injecté
// dans la page (innerHTML), pour empêcher les injections de script (XSS).
function echapperHtml(texte) {
  if (texte === null || texte === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(texte);
  return div.innerHTML;
}

// ============================================
// HELPERS D'AUTHENTIFICATION
// ============================================

async function inscrireUtilisateur(email, password, nomComplet, telephone) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: nomComplet, telephone: telephone }
    }
  });
  return { data, error };
}

async function connecterUtilisateur(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

async function deconnecterUtilisateur() {
  const { error } = await supabaseClient.auth.signOut();
  return { error };
}

async function getUtilisateurConnecte() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// Redirige vers la connexion si personne n'est connecté
async function protegerPage() {
  const user = await getUtilisateurConnecte();
  if (!user) {
    window.location.href = "connexion";
  }
  return user;
}

// ============================================
// HELPERS OBJETS (items)
// ============================================

// Créer une annonce (objet perdu ou trouvé)
async function creerAnnonce(annonce) {
  const { data, error } = await supabaseClient
    .from("items")
    .insert([annonce])
    .select();
  return { data, error };
}

// Uploader une photo dans le bucket Storage "photos-objets"
async function uploaderPhoto(file, userId) {
  // On nettoie le nom du fichier : on retire les accents, espaces, apostrophes
  // et tout caractère qui n'est pas une lettre/chiffre/point/tiret
  const extension = file.name.split(".").pop();
  const nomNettoye = file.name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents (é -> e)
    .replace(/[^a-zA-Z0-9.-]/g, "_");                  // remplace le reste par _

  const nomFichier = `${userId}/${Date.now()}_${nomNettoye}`;
  const { data, error } = await supabaseClient
    .storage
    .from("photos-objets")
    .upload(nomFichier, file);

  if (error) return { url: null, error };

  const { data: urlData } = supabaseClient
    .storage
    .from("photos-objets")
    .getPublicUrl(nomFichier);

  return { url: urlData.publicUrl, error: null };
}

// Lister les annonces avec filtres optionnels
async function listerAnnonces({ statut, categorie, ville, recherche } = {}) {
  let query = supabaseClient.from("items").select("*").order("created_at", { ascending: false });

  if (statut) query = query.eq("statut", statut);
  if (categorie) query = query.eq("categorie", categorie);
  if (ville) query = query.ilike("lieu", `%${ville}%`);
  if (recherche) query = query.ilike("titre", `%${recherche}%`);

  const { data, error } = await query;
  return { data, error };
}

// Récupérer une annonce par son id
async function getAnnonce(id) {
  const { data, error } = await supabaseClient
    .from("items")
    .select("*")
    .eq("id", id)
    .single();
  return { data, error };
}

// Mes annonces (tableau de bord)
async function mesAnnonces(userId) {
  const { data, error } = await supabaseClient
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data, error };
}
