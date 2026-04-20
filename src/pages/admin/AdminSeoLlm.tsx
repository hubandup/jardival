import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Bot, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface Endpoint {
  label: string;
  description: string;
  url: string;
  contentType: string;
}

const endpoints: Endpoint[] = [
  {
    label: "llms.txt (index)",
    description: "Index Markdown standard pour les LLM (catégories, magasins, promos clés).",
    url: `${FN_BASE}/llms`,
    contentType: "text/markdown",
  },
  {
    label: "llms-full.txt (contenu complet)",
    description: "Catalogue complet, tous les magasins avec horaires, toutes les promotions actives.",
    url: `${FN_BASE}/llms-full.txt`,
    contentType: "text/markdown",
  },
  {
    label: "Catalogue produits (JSON)",
    description: "Flux structuré de tous les produits actifs.",
    url: `${FN_BASE}/feed/products.json`,
    contentType: "application/json",
  },
  {
    label: "Magasins (JSON)",
    description: "Tous les magasins avec adresse, horaires, services, coordonnées.",
    url: `${FN_BASE}/feed/stores.json`,
    contentType: "application/json",
  },
  {
    label: "Promotions actives (JSON)",
    description: "Promotions en cours, filtrées par date.",
    url: `${FN_BASE}/feed/promotions.json`,
    contentType: "application/json",
  },
  {
    label: "Sitemap XML",
    description: "Index toutes les pages publiques pour les moteurs de recherche.",
    url: `${FN_BASE}/sitemap`,
    contentType: "application/xml",
  },
  {
    label: "Endpoint conversationnel /ask",
    description: "POST { question: string } → réponse IA basée sur les données du site.",
    url: `${FN_BASE}/ask`,
    contentType: "application/json (POST)",
  },
];

export default function AdminSeoLlm() {
  const [copied, setCopied] = useState<string | null>(null);
  const [question, setQuestion] = useState("Quels sont les horaires du magasin d'Arbois ?");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    toast.success("URL copiée");
    setTimeout(() => setCopied(null), 1500);
  };

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const r = await fetch(`${FN_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erreur");
      setAnswer(data.answer ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" /> Référencement LLM
        </h1>
        <p className="text-muted-foreground mt-1">
          Endpoints publics pour que ChatGPT, Claude, Gemini, Perplexity et autres puissent indexer et interroger le site Jardival.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Comment ça marche ?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Le fichier <code className="text-xs bg-muted px-1 rounded">robots.txt</code> autorise explicitement les bots des principaux LLM (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.).
            Les flux ci-dessous exposent les données du site dans des formats que les agents IA savent consommer (Markdown via le standard <strong>llms.txt</strong>, JSON pour les flux structurés).
            Chaque page produit / magasin embarque aussi du <strong>JSON-LD schema.org</strong> pour la compréhension automatique.
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Endpoints publics</h2>
        {endpoints.map((e) => (
          <Card key={e.url} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{e.label}</span>
                <span className="text-[10px] uppercase tracking-wider rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {e.contentType}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{e.description}</p>
              <code className="text-xs text-muted-foreground break-all mt-1 inline-block">{e.url}</code>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => copy(e.url)}>
                {copied === e.url ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                Copier
              </Button>
              {!e.contentType.includes("POST") && (
                <Button variant="outline" size="sm" asChild>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Ouvrir
                  </a>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Tester l'endpoint conversationnel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Simule une question posée par un agent IA (ChatGPT, Claude, etc.) qui appellerait l'endpoint <code className="text-xs bg-muted px-1 rounded">/ask</code>.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Question</Label>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex: Quelles sont les promos en cours sur l'arrosage ?" />
        </div>
        <Button onClick={ask} disabled={asking || !question.trim()}>
          {asking && <Loader2 className="h-4 w-4 animate-spin" />}
          Envoyer
        </Button>
        {answer && (
          <div className="space-y-2">
            <Label>Réponse</Label>
            <Textarea value={answer} readOnly rows={10} className="font-mono text-sm" />
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-2">
        <h2 className="font-semibold text-lg">Comment soumettre le site aux LLM ?</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>OpenAI / ChatGPT</strong> : aucune action requise. GPTBot crawle automatiquement les sites qui l'autorisent dans <code className="text-xs bg-muted px-1 rounded">robots.txt</code>.
          </li>
          <li>
            <strong>Anthropic / Claude</strong> : ClaudeBot est désormais autorisé via <code className="text-xs bg-muted px-1 rounded">robots.txt</code>.
          </li>
          <li>
            <strong>Google / Gemini</strong> : Google-Extended autorisé. Soumettre le sitemap XML dans Google Search Console pour accélérer l'indexation.
          </li>
          <li>
            <strong>Perplexity</strong> : PerplexityBot autorisé, indexation automatique.
          </li>
          <li>
            <strong>Bing / Copilot</strong> : couvert par Bingbot (déjà actif).
          </li>
        </ul>
      </Card>
    </div>
  );
}
