// api/creer-paiement.js
// Fonction serveur Vercel — jamais exécutée dans le navigateur.
// Reçoit l'utilisateur, crée une référence de paiement en base,
// puis demande à Wave un lien de paiement (checkout session).

const { createClient } = require("@supabase/supabase-js");

// Clé service_role : accès complet, UNIQUEMENT côté serveur (jamais dans le JS client)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId manquant" });
    }

    // Référence unique pour tracer ce paiement précis
    const reference = `RECH-${userId.slice(0, 8)}-${Date.now()}`;

    // 1. On enregistre le paiement "en_attente" dans Supabase AVANT d'appeler Wave
    const { error: dbError } = await supabaseAdmin
      .from("paiements_recherche")
      .insert([{
        user_id: userId,
        montant: 25,
        statut: "en_attente",
        reference: reference
      }]);

    if (dbError) throw dbError;

    // 2. On appelle l'API Wave Business pour créer la session de paiement
    //    /!\ À RECONFIRMER avec la vraie doc Wave une fois ton compte Business
    //    créé (dashboard Wave > Developers > Documentation) : noms de champs,
    //    format exact de la réponse. Ce qui suit est basé sur le schéma
    //    habituel de Wave Business (non vérifié sur une source officielle).
    const waveResponse = await fetch("https://api.wave.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WAVE_API_KEY}`
      },
      body: JSON.stringify({
        amount: 25,              // Wave attend un entier en FCFA (pas de centimes)
        currency: "XOF",
        client_reference: reference, // notre référence à nous, à retrouver dans le webhook
        success_url: `${process.env.SITE_URL}/pages/annonces?paiement=succes`,
        error_url: `${process.env.SITE_URL}/pages/annonces?paiement=annule`
      })
    });

    const waveData = await waveResponse.json();

    if (!waveResponse.ok) {
      throw new Error(waveData.message || "Erreur Wave");
    }

    // On stocke l'id de session Wave pour le retrouver au webhook
    await supabaseAdmin
      .from("paiements_recherche")
      .update({ saaspay_transaction_id: waveData.id })
      .eq("reference", reference);

    // On renvoie l'URL de paiement au navigateur pour rediriger l'utilisateur
    return res.status(200).json({
      paymentUrl: waveData.wave_launch_url,
      reference
    });

  } catch (err) {
    console.error("Erreur creer-paiement:", err);
    return res.status(500).json({ error: err.message });
  }
};
