import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface ServiceStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    cluster: ecs.Cluster;
    nlb: elbv2.NetworkLoadBalancer;
    nlbSG: ec2.SecurityGroup;
    capacityProvider: ecs.AsgCapacityProvider;
}

export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const containerPort = 3000;

        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
            networkMode: ecs.NetworkMode.AWS_VPC
        });

        const container = taskDefinition.addContainer('Container', {
            image: ecs.ContainerImage.fromAsset('./my-service/'),
            memoryLimitMiB: 256,
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'my-service'
            }),
            // to speed up deployments
            // Source 1: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/load-balancer-connection-draining.html
            // Source 2: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.CfnTaskDefinition.ContainerDefinitionProperty.html#stoptimeout
            stopTimeout: cdk.Duration.seconds(2),
        });

        container.addPortMappings({ containerPort });

        const ecsSG = new ec2.SecurityGroup(this, 'ECSSecurityGroup', { vpc: props.vpc });
        ecsSG.addIngressRule(props.nlbSG, ec2.Port.tcp(80));
        ecsSG.addIngressRule(props.nlbSG, ec2.Port.tcp(containerPort));

        const service = new ecs.Ec2Service(this, 'Service', {
            cluster: props.cluster,
            taskDefinition,
            minHealthyPercent: 0,
            maxHealthyPercent: 100,
            capacityProviderStrategies: [
                {
                    capacityProvider: props.capacityProvider.capacityProviderName,
                    weight: 1,
                },
            ],
            securityGroups: [ecsSG],
        });

        const listener = props.nlb.addListener('HTTP', { port: 80 });
        const targetGroup = listener.addTargets('ECS', {
            port: containerPort,
            // to speed up deployments
            // Source: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/load-balancer-healthcheck.html
            healthCheck: {
                interval: cdk.Duration.seconds(5),
                timeout: cdk.Duration.seconds(2),
                healthyThresholdCount: 2
            },
            // to speed up deployments
            // Source: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/load-balancer-connection-draining.html
            deregistrationDelay: cdk.Duration.seconds(5)
        });
        targetGroup.addTarget(service);

        new cdk.CfnOutput(this, 'LoadBalancerDnsName', { value: props.nlb.loadBalancerDnsName });

    }
}
