import { NextResponse, type NextRequest } from 'next/server';

type Role = 'admin' | 'gym_owner' | 'gym_member';

const protectedRoutes: Array<{ prefix: string; role: Role; dashboard: string }> = [
	{ prefix: '/member', role: 'gym_member', dashboard: '/member/dashboard' },
	{ prefix: '/owner', role: 'gym_owner', dashboard: '/owner/dashboard' },
	{ prefix: '/admin', role: 'admin', dashboard: '/admin/dashboard' },
];

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
	const parts = token.split('.');

	if (parts.length < 2) {
		console.error('[Middleware] Invalid JWT format - less than 2 parts');
		return null;
	}

	try {
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
		const payloadJson = atob(padded);
		const payload = JSON.parse(payloadJson) as Record<string, unknown>;
		console.log('[Middleware] JWT decoded successfully, role:', payload.role);
		return payload;
	} catch (error) {
		console.error('[Middleware] JWT decode failed:', error instanceof Error ? error.message : error);
		return null;
	}
};

const getRouteRule = (pathname: string) =>
	protectedRoutes.find((route) => pathname.startsWith(route.prefix));

const getRoleFromPayload = (payload: Record<string, unknown> | null): Role | null => {
	if (!payload || typeof payload.role !== 'string') {
		return null;
	}

	return payload.role as Role;
};

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const tokenCookie = request.cookies.get('apex_token')?.value;
	
	// Token validation: must exist and not be empty
	const token = tokenCookie && tokenCookie.trim() ? tokenCookie.trim() : null;
	
	const routeRule = getRouteRule(pathname);
	
	console.log('[Middleware] Path:', pathname, '| Token:', token ? 'present' : 'missing');

	// Handle /login route
	if (pathname === '/login') {
		if (!token) {
			console.log('[Middleware] /login: no token, allowing access');
			return NextResponse.next();
		}

		// Try to decode JWT
		const payload = decodeJwtPayload(token);
		
		if (!payload) {
			console.log('[Middleware] /login: token decode failed, allowing access (will redirect in client)');
			return NextResponse.next();
		}

		const role = getRoleFromPayload(payload);

		if (!role) {
			console.log('[Middleware] /login: no role in payload, allowing access');
			return NextResponse.next();
		}

		// Valid token + valid role → redirect to dashboard
		const dashboardRoute = protectedRoutes.find((route) => route.role === role);
		
		if (dashboardRoute) {
			console.log('[Middleware] /login: authenticated user with role', role, 'redirecting to', dashboardRoute.dashboard);
			return NextResponse.redirect(new URL(dashboardRoute.dashboard, request.url));
		}

		return NextResponse.next();
	}

	// Not a protected route, allow access
	if (!routeRule) {
		return NextResponse.next();
	}

	// Protected route handler
	
	// 1. Check if token exists and is not empty
	if (!token) {
		console.log('[Middleware] Protected route', pathname, ': no token, redirecting to /login');
		return NextResponse.redirect(new URL('/login', request.url));
	}

	// 2. Try to decode JWT
	const payload = decodeJwtPayload(token);
	
	if (!payload) {
		console.log('[Middleware] Protected route', pathname, ': JWT decode failed, redirecting to /login');
		return NextResponse.redirect(new URL('/login', request.url));
	}

	// 3. Extract role from payload
	const role = getRoleFromPayload(payload);
	
	if (!role) {
		console.log('[Middleware] Protected route', pathname, ': no role in payload, redirecting to /login');
		return NextResponse.redirect(new URL('/login', request.url));
	}

	// 4. Strict role matching
	const expectedRole = routeRule.role;
	
	console.log('[Middleware] Path:', pathname, '| Expected role:', expectedRole, '| Actual role:', role);
	
	if (role !== expectedRole) {
		console.log('[Middleware] Role mismatch! Expected', expectedRole, 'but got', role, '→ redirecting to /login');
		return NextResponse.redirect(new URL('/login', request.url));
	}

	console.log('[Middleware] Path:', pathname, '| Role match valid, allowing access');
	return NextResponse.next();
}

export const config = {
  matcher: [
    '/member/:path*',
    '/owner/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ]
}
