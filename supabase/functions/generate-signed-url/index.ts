import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as mod from "https://deno.land/std@0.177.0/dotenv/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

console.log(`Function "generate-signed-url" up and running!`);

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow requests from any origin (adjust for production)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS methods
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { link_id, password } = await req.json()

    if (!link_id) {
      throw new Error('Missing link_id parameter')
    }

    // Load environment variables from .env
    // Adjust path as needed depending on where you run the function from
    // Might be different in local development vs deployed function
    const config = await mod.config({
      path: "../.env", // Assumes .env is one level up from the function directory
      export: true,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL or Service Key not found in environment variables.');
    }


    // Create Supabase client with service_role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            // Required to use service_role key
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    // Fetch the shared link details, including title and description
    const { data: linkData, error: linkError } = await supabase
      .from('shared_links')
      .select('file_path, access_code, title, description') // <-- Select title and description
      .eq('id', link_id)
      .single()

    if (linkError || !linkData) {
      console.error('Error fetching link or link not found:', linkError);
      throw new Error(linkError?.message || 'Shared link not found')
    }

    // Check if password is required and verify
    if (linkData.access_code) {
      if (!password) {
        return new Response(JSON.stringify({ error: 'Password required' }), {
          status: 401, // Unauthorized
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const passwordMatch = await bcrypt.compare(password, linkData.access_code);
      if (!passwordMatch) {
        return new Response(JSON.stringify({ error: 'Invalid password' }), {
          status: 401, // Unauthorized
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }


    // Generate signed URL (assuming user is authenticated via service_role)
    // The file path is stored in linkData.file_path
    const filePath = linkData.file_path;
    const bucketName = 'jewelry-models'; // Make sure this matches your bucket name
    const expiresIn = 60 * 60 // 1 hour in seconds

    const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      throw new Error(signedUrlError?.message || 'Could not generate signed URL')
    }

    // Return the signed URL along with title and description
    return new Response(
      JSON.stringify({
        signedUrl: signedUrlData.signedUrl,
        title: linkData.title, // <-- Include title
        description: linkData.description // <-- Include description
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Use 500 for general server errors
    })
  }
}) 