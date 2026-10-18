#!/usr/bin/env bash
# Deploy both Cloud Run services and wire Pub/Sub + Scheduler. Run from the repo root.
set -euo pipefail
P=field-to-fix
R=asia-southeast1
SA=f2f-run@$P.iam.gserviceaccount.com

echo "== f2f-agents"
gcloud run deploy f2f-agents --quiet --source agents --region $R --project $P \
  --service-account $SA --memory 2Gi --cpu 2 --timeout 900 --min-instances 1 --no-cpu-throttling \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$P,GOOGLE_CLOUD_LOCATION=global,EMBED_LOCATION=us-central1,BQ_DATASET=f2f,BQ_LOCATION=$R,GCS_BUCKET=$P-f2f,PUBSUB_TOPIC=claims-new,AS_OF_DATE=2026-10-17,ALLOWED_ORIGINS=http://localhost:3000"
API_URL=$(gcloud run services describe f2f-agents --region $R --project $P --format='value(status.url)')
echo "API: $API_URL"

echo "== f2f-web"
sed "s#^NEXT_PUBLIC_API_URL=.*#NEXT_PUBLIC_API_URL=$API_URL#" web/.env.local > web/.env.production
gcloud run deploy f2f-web --quiet --source web --region $R --project $P --allow-unauthenticated --memory 1Gi
WEB_URL=$(gcloud run services describe f2f-web --region $R --project $P --format='value(status.url)')
echo "WEB: $WEB_URL"

echo "== CORS + auth domain"
gcloud run services update f2f-agents --region $R --project $P \
  --update-env-vars "^@^ALLOWED_ORIGINS=http://localhost:3000,$WEB_URL"

echo "== Pub/Sub push + hourly signal scan"
gcloud pubsub subscriptions create claims-push --topic claims-new --project $P \
  --push-endpoint="$API_URL/pubsub/claims" --push-auth-service-account=$SA 2>/dev/null || \
gcloud pubsub subscriptions update claims-push --project $P --push-endpoint="$API_URL/pubsub/claims" --push-auth-service-account=$SA
gcloud scheduler jobs create http signal-hourly --location $R --project $P --schedule="0 * * * *" \
  --uri="$API_URL/signal/run" --http-method=POST --oidc-service-account-email=$SA 2>/dev/null || true

echo "Done. Add $(echo $WEB_URL | sed 's#https://##') to Firebase Auth authorized domains."
