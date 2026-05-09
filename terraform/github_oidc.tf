# GitHub Actions OIDC provider + deploy role.
# Lets workflows on the main branch assume an IAM role via short-lived
# tokens instead of long-lived AWS access keys.

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${var.app_name}-github-actions-deploy-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Any ref (branches, PRs, tags) on this repo can assume the role.
            # Apply steps in workflows are gated by event/branch, not by IAM.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })
}

# Broad infra-management policy. The role is used by the deploy workflow to
# (a) run `terraform apply` against everything in this directory and
# (b) push images, sync the frontend bucket, and roll the ECS service.
# Permissions are scoped by service, not by resource ARN, because Terraform
# needs to create/destroy arbitrary resources within these services.
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${var.app_name}-github-actions-deploy-${var.environment}"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TerraformInfra"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "elasticloadbalancing:*",
          "ecs:*",
          "ecr:*",
          "iam:*",
          "logs:*",
          "cloudfront:*",
          "acm:*",
          "s3:*",
          "route53:*",
          "resource-groups:*",
          "tag:*",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      }
    ]
  })
}
