// api/creer-paiement.js
// Fonction serveur Vercel — jamais exécutée dans le navigateur.
// Reçoit l'utilisateur, crée une référence de paiement en base,
// puis demande à SaaSPay un lien de paiement.

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

    // 1. On enregistre le paiement "en_attente" dans Supabase AVANT d'appeler SaaSPay
    const { error: dbError } = await supabaseAdmin
      .from("paiements_recherche")
      .insert([{
        user_id: userId,
        montant: 150,
        statut: "en_attente",
        reference: reference
      }]);

    if (dbError) throw dbError;

    // 2. On appelle l'API SaaSPay pour créer la transaction
    //    /!\ ADAPTE cette partie selon la doc exacte de ton compte SaaSPay
    //    (URL, noms des champs, format de la réponse peuvent différer).
    const saaspayResponse = await fetch("https://api.saaspay.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SAASPAY_SECRET_KEY}`
      },
      body: JSON.stringify({
        amount: 150,
        currency: "XOF",
        reference: reference,
        description: "Recherche supplémentaire - RetrouveMoi",
        callback_url: `${process.env.SITE_URL}/api/webhook-saaspay`,
        return_url: `${process.env.SITE_URL}/pages/annonces.html?paiement=succes`,
        cancel_url: `${process.env.SITE_URL}/pages/annonces.html?paiement=annule`
      })
    });

    const saaspayData = await saaspayResponse.json();

    if (!saaspayResponse.ok) {
      throw new Error(saaspayData.message || "Erreur SaaSPay");
    }

    // On stocke l'id de transaction SaaSPay pour le retrouver au webhook
    await supabaseAdmin
      .from("paiements_recherche")
      .update({ saaspay_transaction_id: saaspayData.id || saaspayData.transaction_id })
      .eq("reference", reference);

    // On renvoie l'URL de paiement au navigateur pour rediriger l'utilisateur
    return res.status(200).json({
      paymentUrl: saaspayData.payment_url || saaspayData.checkout_url,
      reference
    });

  } catch (err) {
    console.error("Erreur creer-paiement:", err);
    return res.status(500).json({ error: err.message });
  }
};
