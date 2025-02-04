resource "aws_resourcegroups_group" "wishlist" {
  name = "${var.app_name}-${var.environment}"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = [
        "AWS::ECS::Cluster",
        "AWS::ECS::Service",
        "AWS::ElasticLoadBalancingV2::LoadBalancer",
        "AWS::ElasticLoadBalancingV2::TargetGroup",
        "AWS::Logs::LogGroup",
        "AWS::ECR::Repository",
        "AWS::EC2::VPC",
        "AWS::EC2::SecurityGroup"
      ]
      TagFilters = [
        {
          Key    = "Environment"
          Values = [var.environment]
        },
        {
          Key    = "Application"
          Values = [var.app_name]
        }
      ]
    })
  }

  tags = {
    Environment = var.environment
    Application = var.app_name
  }
} 