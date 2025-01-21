output "frontend_repository_url" {
  description = "The URL of the frontend repository"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_repository_url" {
  description = "The URL of the backend repository"
  value       = aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "The DNS name of the load balancer"
  value       = aws_lb.main.dns_name
} 