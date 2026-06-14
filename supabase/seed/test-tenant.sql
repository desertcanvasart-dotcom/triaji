-- ============================================================================
-- Test Tenant for Widget Development
-- Run this manually in Supabase SQL editor before testing the widget
-- ============================================================================

-- Insert test tenant
INSERT INTO tenants (name_ar, name_en, slug, tier, is_active)
VALUES ('عيادة الاختبار', 'Test Clinic', 'test-clinic', 'basic', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert tenant config with localhost allowed
INSERT INTO tenant_config (
  tenant_id, primary_color, welcome_message_ar, widget_domains, booking_mode
)
SELECT
  id,
  '0D7A7A',
  'أهلاً بيك في عيادة الاختبار! كيف أقدر أساعدك؟',
  ARRAY['localhost', '127.0.0.1'],
  'native'
FROM tenants WHERE slug = 'test-clinic'
ON CONFLICT (tenant_id) DO NOTHING;
