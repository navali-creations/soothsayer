import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game");

    if (!game) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: game" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!["poe1", "poe2"].includes(game)) {
      return new Response(
        JSON.stringify({ error: "Invalid game. Must be poe1 or poe2" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Query leagues from database
    const { data: leagues, error } = await supabase
      .from("poe_leagues")
      .select("*")
      .eq("game", game)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    // Format response
    const response = {
      leagues: (leagues || []).map((league) => ({
        id: league.id,
        leagueId: league.league_id,
        name: league.name,
        startAt: league.start_at,
        endAt: league.end_at,
        isActive: league.is_active,
        updatedAt: league.updated_at,
      })),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-leagues-legacy:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
