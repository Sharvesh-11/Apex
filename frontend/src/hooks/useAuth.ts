import useAuthStore from '@/store/authStore';

const useAuth = () => {
	const user = useAuthStore((state) => state.user);
	const role = useAuthStore((state) => state.role);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const login = useAuthStore((state) => state.login);
	const logout = useAuthStore((state) => state.logout);

	const isRole = (...roles: string[]) => {
		if (!role) {
			return false;
		}

		return roles.includes(role);
	};

	return {
		user,
		role,
		isAuthenticated,
		login,
		logout,
		isRole,
	};
};

export default useAuth;
