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
  marketingNewsletterSignupSubmit: 'marketing:newsletter_signup_submit',
  marketingNewsletterSignupSuccess: 'marketing:newsletter_signup_success',
  marketingNewsletterSignupFail: 'marketing:newsletter_signup_fail',
  docsSearchSubmit: 'docs:search_submit',
  docsSearchResultClick: 'docs:search_result_click',
  docsCopyPromptClick: 'docs:copy_prompt_click',
  docsCopyCodeClick: 'docs:copy_code_click',
  docsTabSelect: 'docs:tab_select',
  docsSidebarSectionToggle: 'docs:sidebar_section_toggle',
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type AnalyticsSurface =
  | 'nav'
  | 'mobile_nav'
  | 'footer'
  | 'home'
  | 'pricing'
  | 'docs'
  | 'library_landing'
  | 'solution'
  | 'toast';

export type AnalyticsLibrary = 'agent' | 'render' | 'chat' | 'unknown';

export type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

export type AnalyticsProperties = {
  source_page?: string;
  source_section?: string;
  destination_url?: string;
  cta_id?: string;
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
