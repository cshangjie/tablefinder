declare global {
	namespace App {
		interface Locals {
			isAuthenticated: boolean;
		}
		
		interface Platform {}
	}
}

export {};