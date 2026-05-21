export type UserRole = 'admin' | 'gym_owner' | 'gym_member';

export type PlanBillingCycle = 'monthly' | 'half_yearly' | 'annual';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export type PaymentMethod = 'razorpay' | 'cash';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type AttendanceMethod = 'qr' | 'pin';

export interface User {
	id: string;
	email: string;
	role: UserRole;
	is_active: boolean;
}

export interface Member {
	id: string;
	user_id: string;
	full_name: string;
	phone?: string;
	profile_photo_url?: string;
	qr_code?: string;
	pin?: string;
	joined_at: string;
	is_active: boolean;
	email: string;
}

export interface Plan {
	id: string;
	name: string;
	description?: string;
	price: number;
	billing_cycle: PlanBillingCycle;
	is_active: boolean;
	created_at: string;
}

export interface Subscription {
	id: string;
	member_id: string;
	plan_id: string;
	start_date: string;
	end_date: string;
	status: SubscriptionStatus;
	created_at: string;
	plan: Plan;
}

export interface Payment {
	id: string;
	member_id: string;
	subscription_id: string;
	amount: number;
	payment_method: PaymentMethod;
	payment_status: PaymentStatus;
	razorpay_order_id?: string;
	razorpay_payment_id?: string;
	notes?: string;
	member_name?: string;
	paid_at?: string;
	created_at: string;
}

export interface AttendanceLog {
	id: string;
	member_id: string;
	checked_in_at: string;
	method: AttendanceMethod;
}

export interface GalleryImage {
	id: string;
	image_url: string;
	caption?: string;
	display_order: number;
	uploaded_at: string;
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	role: string;
	user_id: string;
}

export type AdminSubscriptionCreate = {
	member_id: string;
	plan_id: string;
	payment_method: PaymentMethod;
	start_date?: string;
	notes?: string;
};

export type MemberWithSubscription = Member & {
	subscription?: Subscription;
};
