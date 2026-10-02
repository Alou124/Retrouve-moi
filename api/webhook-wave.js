// api/webhook-wave.js
// Wave appelle cette URL automatiquement quand un paiement est confirmé.
// C'est ICI que le crédit de recherche est réellement ajouté (jamais depuis le
// navigateur, pour éviter qu'un utilisateur triche en simulant un paiement réussi).
//
// /!\ IMPORTANT : cette URL doit être configurée une fois dans le dashboard
// Wave Business (section Developers > Webhooks), avec l'adresse :
// https://TON-SITE.vercel.app/api/webhook-wave
// — Wave n'accepte pas forcément de callback_url envoyée à la volée par requête.

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vérifie que la requête vient bien de Wave.
// /!\ À RECONFIRMER avec la doc Wave exacte : nom du header (observé:
// "X-Wave-Signature") et méthode de calcul (HMAC avec le secret webhook
// donné dans le dashboard Wave Business > Developers).
function verifierSignature(req) {
  const signatureRecue = req.headers["x-wave-signature"];
  if (!signatureRecue) return false;

  const signatureCalculee = crypto
    .createHmac("sha256", process.env.WAVE_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return signatureRecue === signatureCalculee;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  // 1. Vérifier l'authenticité de la requête
  if (!verifierSignature(req)) {
    console.warn("Webhook Wave : signature invalide");
    return res.status(401).json({ error: "Signature invalide" });
  }

  try {
    // /!\ ADAPTE les noms de champs ci-dessous à la structure réelle du payload
    // envoyé par Wave (à vérifier dans leur doc/dashboard une fois le compte créé).
    // Schéma observé dans la doc Wave : un objet "event" avec un "type"
    // (ex: "checkout.session.completed") et les données de la session dedans.
    const evenement = req.body;
    const session = evenement.data || evenement; // selon comment Wave structure le payload
    const reference = session.client_reference;
    const transaction_id = session.id;
    const typeEvenement = evenement.type;

    if (typeEvenement !== "checkout.session.completed") {
      // Paiement échoué, annulé, ou événement non pertinent : on met juste à jour le statut
      await supabaseAdmin
        .from("paiements_recherche")
        .update({ statut: "echoue" })
        .eq("reference", reference);
      return res.status(200).json({ received: true });
    }

    // 2. Récupérer le paiement correspondant
    const { data: paiement, error: findError } = await supabaseAdmin
      .from("paiements_recherche")
      .select("*")
      .eq("reference", reference)
      .single();

    if (findError || !paiement) {
      console.error("Paiement introuvable pour la référence:", reference);
      return res.status(404).json({ error: "Paiement introuvable" });
    }

    // Sécurité anti double-crédit : si déjà marqué "reussi", on ne recrédite pas
    if (paiement.statut === "reussi") {
      return res.status(200).json({ received: true, deja_traite: true });
    }

    // 3. Marquer le paiement comme réussi
    await supabaseAdmin
      .from("paiements_recherche")
      .update({
        statut: "reussi",
        saaspay_transaction_id: transaction_id,
        paye_at: new Date().toISOString()
      })
      .eq("reference", reference);

    // 4. Créditer une recherche supplémentaire sur le profil de l'utilisateur
    const { error: creditError } = await supabaseAdmin.rpc("incrementer_credits", {
      p_user_id: paiement.user_id,
      p_montant: 1
    });

    if (creditError) throw creditError;

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Erreur webhook-wave:", err);
    return res.status(500).json({ error: err.message });
  }
};
