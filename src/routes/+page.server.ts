import { fail, redirect } from '@sveltejs/kit';
import { LOGIN_PASSWORD } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const session = cookies.get('session');
	if (session === 'authenticated') {
		throw redirect(303, '/restaurants');
	}
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password') as string;

		if (!LOGIN_PASSWORD) {
			console.error('LOGIN_PASSWORD environment variable not set');
			return fail(500, { error: 'Server configuration error' });
		}

		if (password !== LOGIN_PASSWORD) {
			return fail(400, { error: 'Incorrect password' });
		}

		cookies.set('session', 'authenticated', {
			path: '/',
			httpOnly: true,
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		throw redirect(303, '/restaurants');
	}
};