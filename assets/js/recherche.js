// assets/js/recherche.js
// Gère le quota "1ère recherche gratuite, puis 25 FCFA/recherche"
// Nécessite que supabaseClient.js soit chargé avant ce fichier.

// Appelle la fonction SQL consommer_recherche() : true = autorisé, false = paiement requis
async function verifierQuotaRecherche() {
  const user = await getUtilisateurConnecte();
  if (!user) {
    window.location.href = "connexion";
    return false;
  }

  const { data: autorise, error } = await supabaseClient.rpc("consommer_recherche", {
    p_user_id: user.id
  });

  if (error) {
    console.error("Erreur vérification quota:", error);
    return false;
  }

  return autorise;
}

// Ouvre le paiement Wave de 25 FCFA
async function lancerPaiementRecherche() {
  const user = await getUtilisateurConnecte();
  if (!user) return;

  const boutonPaiement = document.getElementById("btn-payer-recherche");
  if (boutonPaiement) {
    boutonPaiement.disabled = true;
    boutonPaiement.textContent = "Redirection en cours...";
  }

  try {
    const reponse = await fetch("/api/creer-paiement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });

    const { paymentUrl, error } = await reponse.json();

    if (error || !paymentUrl) {
      alert("Impossible de créer le paiement. Réessaie dans un instant.");
      return;
    }

    // Redirection vers la page de paiement Wave
    window.location.href = paymentUrl;

  } catch (err) {
    console.error("Erreur lancement paiement:", err);
    alert("Une erreur est survenue.");
  } finally {
    if (boutonPaiement) {
      boutonPaiement.disabled = false;
      boutonPaiement.textContent = "Payer 25 FCFA";
    }
  }
}

// À appeler avant d'afficher les résultats d'une recherche
// Exemple d'utilisation dans annonces.html :
//
//   const peutChercher = await verifierQuotaRecherche();
//   if (!peutChercher) {
//     afficherModalPaiement(); // montre une modale Bootstrap avec le bouton de paiement
//     return;
//   }
//   // ... sinon on exécute la recherche normalement
//
function afficherModalPaiement() {
  const modal = new bootstrap.Modal(document.getElementById("modalPaiement"));
  modal.show();
}
