import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const session = event.cookies.get('session');
	const isAuthenticated = session === 'authenticated';
	
	event.locals.isAuthenticated = isAuthenticated;
	
	if (event.url.pathname.startsWith('/search') && !isAuthenticated) {
		throw redirect(303, '/');
	}
	
	if (event.url.pathname === '/' && isAuthenticated) {
		throw redirect(303, '/search');
	}

	return resolve(event);
};