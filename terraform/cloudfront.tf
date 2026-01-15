# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${var.app_name}-s3-oac-${var.environment}"
  description                       = "OAC for S3 static frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.app_name} - ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe
  aliases             = ["www.giftguru.cc"]

  # S3 origin for static frontend
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  # ALB origin for backend API
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    custom_header {
      name  = "X-Custom-Header"
      value = var.cloudfront_secret
    }

    # Tell backend the original request was HTTPS (needed for secure cookies)
    custom_header {
      name  = "X-Forwarded-Proto"
      value = "https"
    }
  }

  # Default cache behavior for static frontend (S3)
  default_cache_behavior {
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400    # 1 day
    max_ttl     = 31536000 # 1 year
  }

  # Cache behavior for API calls (ALB)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ALB-backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    # Forward everything to backend for API calls - especially auth headers
    # NOTE: Do NOT forward "Host" header - it causes redirect loops since ALB
    # would receive the CloudFront host instead of its own
    forwarded_values {
      query_string = true
      headers = [
        "Authorization",
        "CloudFront-Forwarded-Proto",
        "CloudFront-Is-Desktop-Viewer",
        "CloudFront-Is-Mobile-Viewer",
        "CloudFront-Is-Tablet-Viewer",
        "Origin",
        "Referer",
        "User-Agent",
        "Accept",
        "Accept-Language",
        "Accept-Encoding",
        "Accept-Charset"
      ]

      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Custom error response for SPA routing
  # When S3 returns 404 or 403, serve index.html
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  # SSL certificate
  viewer_certificate {
    acm_certificate_arn      = var.ssl_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Geo restrictions (none)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Environment = var.environment
    Application = var.app_name
  }

  depends_on = [
    aws_s3_bucket.frontend,
    aws_lb.main
  ]
}

# CloudFront cache invalidation on each deployment (optional - use in CI/CD)
# Commented out as this should be done via deployment script, not on every terraform apply
# resource "null_resource" "cloudfront_invalidation" {
#   triggers = {
#     always_run = timestamp()
#   }
#
#   provisioner "local-exec" {
#     command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.main.id} --paths '/*'"
#   }
# }
