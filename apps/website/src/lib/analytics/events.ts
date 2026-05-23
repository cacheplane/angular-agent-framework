export const analyticsEvents = {
  marketingCtaClick: 'marketing:cta_click',
  marketingExternalLinkClick: 'marketing:external_link_click',
  marketingWhitepaperDownloadClick: 'marketing:whitepaper_download_click',
  marketingWhitepaperSignupSubmit: 'marketing:whitepaper_signup_submit',
  marketingWhitepaperSignupSuccess: 'marketing:whitepaper_signup_success',
  marketingWhitepaperSignupFail: 'marketing:whitepaper_signup_fail',
  marketingLeadFormSubmit: 'marketing:lead_form_submit',
  marketingLeadFormSuccess: 'marketing:lead_form_success',
  marketingLeadFormFail: 'marketing:lead_form_fail',
  marketingLeadQualified: 'marketing:lead_qualified',
  marketingNewsletterSignupSubmit: 'marketing:newsletter_signup_submit',
  marketingNewsletterSignupSuccess: 'marketing:newsletter_signup_success',
  marketingNewsletterSignupFail: 'marketing:newsletter_signup_fail',
  docsSearchSubmit: 'docs:search_submit',
  docsSearchResultClick: 'docs:search_result_click',
  docsCopyPromptClick: 'docs:copy_prompt_click',
  docsCopyCodeClick: 'docs:copy_code_click',
  docsTabSelect: 'docs:tab_select',
  docsSidebarSectionToggle: 'docs:sidebar_section_toggle',
  blogCtaClick: 'blog:cta_click',
  blogCopyCodeClick: 'blog:copy_code_click',
  marketingCheckoutStarted: 'marketing:checkout_started',
  marketingCheckoutSucceeded: 'marketing:checkout_succeeded',
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type AnalyticsSurface =
  | 'nav'
  | 'mobile_nav'
  | 'footer'
  | 'home'
  | 'home_whitepaper'
  | 'pricing'
  | 'docs'
  | 'blog'
  | 'library_landing'
  | 'solution'
  | 'toast'
  | 'contact';

/**
 * Stable identifiers for marketing CTAs. New CTAs must be added to this
 * union so PostHog gets consistent slicing — misspellings then become
 * a build-time error.
 *
 * Template-literal members (e.g. `nav_${string}`) cover callsites that
 * derive cta_id dynamically from a human label.
 */
export type CtaId =
  // Hero (Spec 2)
  | 'hero_install'
  | 'hero_talk_to_engineers'
  | 'hero_demo_open_cockpit'
  | 'hero_demo_open_cockpit_caption'
  | 'hero_proof_pill'
  // Whitepaper block on home
  | 'home_whitepaper_direct'
  | 'home_whitepaper_direct_inline'
  // Why this exists section
  | 'home_why_pilot_to_prod'
  // Pricing tier CTAs
  | 'pricing_tier_community'
  | 'pricing_tier_developer_seat'
  | 'pricing_tier_team'
  | 'pricing_tier_enterprise'
  // Footer licensing links
  | 'footer_licensing'
  | 'footer_licensing_bottom'
  | 'footer_pilot_to_prod'
  | 'footer_ag_ui'
  // Announcement toast
  | 'toast_get_guide'
  | 'toast_direct_download'
  // Docs surfaces — copy buttons take a dynamic label fallback
  | 'copy_code'
  | 'copy_prompt'
  | `copy_${string}`
  // Nav + footer derive ids from labels at runtime
  | `nav_${string}`
  | `mobile_nav_${string}`
  | `footer_${string}`;

export type AnalyticsLibrary = 'agent' | 'render' | 'chat' | 'unknown';

export type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

export type AnalyticsProperties = {
  source_page?: string;
  source_section?: string;
  destination_url?: string;
  cta_id?: CtaId;
  cta_text?: string;
  surface?: AnalyticsSurface;
  library?: AnalyticsLibrary;
  paper?: WhitepaperId;
  email_domain?: string;
  company?: string;
  is_success?: boolean;
  result_count?: number;
  query_length?: number;
  error_reason?: string;
  [key: string]: string | number | boolean | undefined;
};
