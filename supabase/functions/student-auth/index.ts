import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5; // Max 5 attempts per 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minute lockout after max attempts

// In-memory rate limit store (resets on function cold start, but effective for active attacks)
const rateLimitStore = new Map<string, { attempts: number; firstAttempt: number; lockedUntil?: number }>();

// Suspicious activity thresholds
const SUSPICIOUS_ATTEMPTS_THRESHOLD = 3; // 3+ failed attempts from same IP
const SUSPICIOUS_IPS_THRESHOLD = 5; // 5+ different reg numbers from same IP

// Track IPs attempting multiple registrations
const ipAttemptTracker = new Map<string, Set<string>>();

function getRateLimitKey(identifier: string, ip: string): string {
  return `${identifier}:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  // Check if currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfter };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  // Check attempts within window
  if (entry.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    // Lock out the user
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitStore.set(key, entry);
    const retryAfter = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfter };
  }

  // Increment attempts
  entry.attempts++;
  rateLimitStore.set(key, entry);
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - entry.attempts };
}

function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// Track IP attempts for suspicious activity detection
function trackIpAttempt(ip: string, regNumber: string): boolean {
  if (!ipAttemptTracker.has(ip)) {
    ipAttemptTracker.set(ip, new Set());
  }
  const attempts = ipAttemptTracker.get(ip)!;
  attempts.add(regNumber.toLowerCase());
  
  // Return true if suspicious (many different reg numbers from same IP)
  return attempts.size >= SUSPICIOUS_IPS_THRESHOLD;
}

// Cleanup old entries periodically (every 5 minutes worth of requests)
let cleanupCounter = 0;
function cleanupStaleEntries(): void {
  cleanupCounter++;
  if (cleanupCounter < 100) return; // Only cleanup every 100 requests
  cleanupCounter = 0;
  
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than lockout duration + window
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS + LOCKOUT_DURATION_MS) {
      rateLimitStore.delete(key);
    }
  }
  
  // Also cleanup IP tracker
  ipAttemptTracker.clear();
}

// Simple token generation using crypto
async function generateToken(payload: object, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Verify token
async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature
    const signatureStr = encodedSignature
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padding = '='.repeat((4 - signatureStr.length % 4) % 4);
    const signature = Uint8Array.from(atob(signatureStr + padding), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    if (!valid) return { valid: false };
    
    // Decode payload
    const payloadStr = encodedPayload + '='.repeat((4 - encodedPayload.length % 4) % 4);
    const payload = JSON.parse(atob(payloadStr));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return { valid: false };
    }
    
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

// Log authentication attempt to database
async function logAuthAttempt(
  supabase: any,
  data: {
    registration_number?: string;
    ip_address: string;
    user_agent: string;
    action: string;
    success: boolean;
    failure_reason?: string;
  }
): Promise<void> {
  try {
    await supabase.from('auth_logs').insert({
      registration_number: data.registration_number || null,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      action: data.action,
      success: data.success,
      failure_reason: data.failure_reason || null,
    });
  } catch (error) {
    console.error('Failed to log auth attempt:', error);
  }
}

// Extract client info from request
function getClientInfo(req: Request): { ip: string; userAgent: string } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             req.headers.get('cf-connecting-ip') ||
             'unknown';
  
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return { ip, userAgent };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Cleanup stale rate limit entries periodically
  cleanupStaleEntries();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const jwtSecret = supabaseServiceKey; // Use service key as JWT secret for simplicity

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get client info for logging and rate limiting
    const { ip: clientIp, userAgent } = getClientInfo(req);

    if (req.method === 'POST' && action === 'login') {
      // Student login
      const { registration_number, password } = await req.json();

      if (!registration_number) {
        await logAuthAttempt(supabase, {
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'login',
          success: false,
          failure_reason: 'missing_registration_number'
        });
        
        return new Response(
          JSON.stringify({ error: 'Registration number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedRegNumber = registration_number.trim().toLowerCase();
      
      // Track suspicious IP activity
      const isSuspiciousIp = trackIpAttempt(clientIp, normalizedRegNumber);
      if (isSuspiciousIp) {
        console.warn(`[SECURITY] Suspicious activity detected from IP ${clientIp}: attempting multiple registration numbers`);
        await logAuthAttempt(supabase, {
          registration_number: registration_number.trim(),
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'login',
          success: false,
          failure_reason: 'suspicious_ip_activity'
        });
      }

      // Rate limiting check
      const rateLimitKey = getRateLimitKey(normalizedRegNumber, clientIp);
      const rateLimitResult = checkRateLimit(rateLimitKey);

      if (!rateLimitResult.allowed) {
        console.warn(`[SECURITY] Rate limit exceeded for: ${registration_number} from IP: ${clientIp}`);
        
        await logAuthAttempt(supabase, {
          registration_number: registration_number.trim(),
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'login',
          success: false,
          failure_reason: 'rate_limit_exceeded'
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Too many login attempts. Please try again later.',
            retryAfter: rateLimitResult.retryAfter 
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimitResult.retryAfter)
            } 
          }
        );
      }

      console.log(`[AUTH] Login attempt for: ${registration_number} from IP: ${clientIp} (${rateLimitResult.remainingAttempts} attempts remaining)`);

      // Fetch student from database (tolerant lookup: typos like spaces, dots, commas, leading zeros)
      const rawReg = registration_number.trim();
      const cleanedReg = rawReg.replace(/[^a-zA-Z0-9/-]/g, '');
      const noLeadingZeros = cleanedReg.replace(/^0+(?=\d)/, '');
      const candidates = [...new Set([rawReg, cleanedReg, noLeadingZeros].filter(Boolean))];

      let student: any = null;
      let studentError: any = null;
      for (const candidate of candidates) {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name, registration_number, class_id, password_hash')
          .ilike('registration_number', candidate)
          .maybeSingle();
        if (error) { studentError = error; break; }
        if (data) { student = data; break; }
      }


      if (studentError) {
        console.error('[ERROR] Database error:', studentError);
        await logAuthAttempt(supabase, {
          registration_number: registration_number.trim(),
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'login',
          success: false,
          failure_reason: 'database_error'
        });
        
        return new Response(
          JSON.stringify({ error: 'An error occurred during login' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!student) {
        console.log(`[AUTH] Student not found: ${registration_number} from IP: ${clientIp}`);
        
        await logAuthAttempt(supabase, {
          registration_number: registration_number.trim(),
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'login',
          success: false,
          failure_reason: 'student_not_found'
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Registration number not found. Please check your registration number and try again.',
            remainingAttempts: rateLimitResult.remainingAttempts
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password if the student has one set
      if (student.password_hash) {
        if (!password) {
          await logAuthAttempt(supabase, {
            registration_number: registration_number.trim(),
            ip_address: clientIp,
            user_agent: userAgent,
            action: 'login',
            success: false,
            failure_reason: 'password_required'
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Password is required',
              remainingAttempts: rateLimitResult.remainingAttempts
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash the provided password and compare
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (providedHash !== student.password_hash) {
          console.log(`[AUTH] Invalid password for: ${registration_number} from IP: ${clientIp}`);
          
          await logAuthAttempt(supabase, {
            registration_number: registration_number.trim(),
            ip_address: clientIp,
            user_agent: userAgent,
            action: 'login',
            success: false,
            failure_reason: 'invalid_password'
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Invalid registration number or password',
              remainingAttempts: rateLimitResult.remainingAttempts
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Successful login - reset rate limit
      resetRateLimit(rateLimitKey);

      // Generate JWT token with additional security claims
      const token = await generateToken(
        {
          sub: student.id,
          reg: student.registration_number,
          name: student.full_name,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 hours
          ip: clientIp // Bind token to IP for additional security
        },
        jwtSecret
      );

      console.log(`[AUTH] Login successful for: ${registration_number} from IP: ${clientIp}`);
      
      await logAuthAttempt(supabase, {
        registration_number: registration_number.trim(),
        ip_address: clientIp,
        user_agent: userAgent,
        action: 'login',
        success: true
      });

      return new Response(
        JSON.stringify({
          success: true,
          token,
          student: {
            id: student.id,
            full_name: student.full_name,
            registration_number: student.registration_number,
            class_id: student.class_id
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && action === 'verify') {
      // Verify token
      const { token } = await req.json();

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await verifyToken(token, jwtSecret);

      if (!result.valid) {
        await logAuthAttempt(supabase, {
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'verify',
          success: false,
          failure_reason: 'invalid_token'
        });
        
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Optional: Verify IP binding (can be disabled if users switch networks frequently)
      // if (result.payload.ip && result.payload.ip !== clientIp) {
      //   console.warn(`[SECURITY] Token IP mismatch: expected ${result.payload.ip}, got ${clientIp}`);
      // }

      await logAuthAttempt(supabase, {
        registration_number: result.payload.reg,
        ip_address: clientIp,
        user_agent: userAgent,
        action: 'verify',
        success: true
      });

      return new Response(
        JSON.stringify({
          valid: true,
          student: {
            id: result.payload.sub,
            registration_number: result.payload.reg,
            full_name: result.payload.name
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && action === 'results') {
      // Get student results
      const { token } = await req.json();

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResult = await verifyToken(token, jwtSecret);

      if (!tokenResult.valid) {
        await logAuthAttempt(supabase, {
          ip_address: clientIp,
          user_agent: userAgent,
          action: 'results',
          success: false,
          failure_reason: 'invalid_token'
        });
        
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const studentId = tokenResult.payload.sub;

      console.log(`[AUTH] Results request for student ID: ${studentId} from IP: ${clientIp}`);

      // Fetch student details
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          registration_number,
          class_id,
          classes (
            id,
            name
          )
        `)
        .eq('id', studentId)
        .single();

      if (studentError || !student) {
        console.error('[ERROR] Error fetching student:', studentError);
        return new Response(
          JSON.stringify({ error: 'Student not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch results for this student
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select(`
          id,
          marks,
          term,
          academic_year,
          subjects (
            id,
            name
          )
        `)
        .eq('student_id', studentId);

      if (resultsError) {
        console.error('[ERROR] Error fetching results:', resultsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch results' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate student's rank in their class
      let rank = null;
      let totalStudentsInClass = 0;

      if (student.class_id) {
        // Get all students in the same class with their total marks
        const { data: classResults, error: classResultsError } = await supabase
          .from('results')
          .select(`
            student_id,
            marks,
            students!inner (
              class_id,
              full_name
            )
          `)
          .eq('students.class_id', student.class_id);

        if (!classResultsError && classResults) {
          // Calculate totals for each student
          const studentTotals = new Map<string, number>();
          const studentNames = new Map<string, string>();
          
          classResults.forEach((r: any) => {
            const sid = r.student_id;
            const currentTotal = studentTotals.get(sid) || 0;
            studentTotals.set(sid, currentTotal + (r.marks || 0));
            studentNames.set(sid, r.students?.full_name || '');
          });

          // Sort by total marks (desc), tie-break alphabetically by name
          const sortedStudents = Array.from(studentTotals.entries())
            .sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return (studentNames.get(a[0]) || '').localeCompare(studentNames.get(b[0]) || '');
            });

          totalStudentsInClass = sortedStudents.length;
          
          // Find current student's rank
          const studentIndex = sortedStudents.findIndex(([sid]) => sid === studentId);
          if (studentIndex !== -1) {
            rank = studentIndex + 1;
          }
        }
      }

      await logAuthAttempt(supabase, {
        registration_number: student.registration_number,
        ip_address: clientIp,
        user_agent: userAgent,
        action: 'results',
        success: true
      });

      return new Response(
        JSON.stringify({
          student: {
            id: student.id,
            full_name: student.full_name,
            registration_number: student.registration_number,
            class_name: (student.classes as any)?.name || 'Not assigned'
          },
          results: results || [],
          ranking: {
            rank,
            totalStudents: totalStudentsInClass
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERROR] Error in student-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
