resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Environment = var.environment
    Application = var.app_name
  }
}


resource "aws_ecs_task_definition" "backend" {
  family                   = "wishlist-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${aws_ecr_repository.backend.repository_url}:latest"
      portMappings = [
        {
          containerPort = 5000
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "5000"
        },
        {
          name  = "FRONTEND_URL"
          value = "https://www.giftguru.cc"
        },
        {
          name  = "COOKIE_DOMAIN"
          value = "www.giftguru.cc"
        }
      ]
      secrets = [
        {
          name      = "MONGODB_URI"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/MONGODB_URI"
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/GOOGLE_CLIENT_ID"
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/GOOGLE_CLIENT_SECRET"
        },
        {
          name      = "SESSION_SECRET"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/SESSION_SECRET"
        },
        {
          name      = "GOOGLE_SA_USERNAME"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/GOOGLE_SA_USERNAME"
        },
        {
          name      = "GOOGLE_APP_PASSWORD"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/GOOGLE_APP_PASSWORD"
        },
        {
          name      = "ADMIN_EMAILS"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/wishlist/ADMIN_EMAILS"
        }
      ]
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/wishlist-backend"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/wishlist-backend"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.app_name}-backend-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 5000
  }

  tags = {
    Environment = var.environment
    Application = var.app_name
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]
} 
