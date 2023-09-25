# network-load-balanced-ecs-service-rust

Similar to [network-load-balanced-ecs-service](https://github.com/aws/aws-cdk/blob/v2.97.0/packages/aws-cdk-lib/aws-ecs-patterns/lib/ecs/network-load-balanced-ecs-service.ts) from aws-ecs-patterns, this repository shows an example of an EC2 ECS Service behind a Network Load Balancer.

This example does not use the [NetworkLoadBalancedEc2Service](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns.NetworkLoadBalancedEc2Service.html) construct and instead breaks apart each individual component.

In this example we split the VPC, ECS Cluster, and NLB into one the `infra` stack and the ECS Task Definition and Service into the `service` stack.

In addition, this example shows how one would create a monorepo that also contains a rust service located in the [my-service](./my-service/) folder. When running `cdk deploy`, it will use a multi-stage docker build to compile the rust binary and copy it into a slim container.

This example also makes use of the [new NLB security groups](https://aws.amazon.com/blogs/containers/network-load-balancers-now-support-security-groups/) which isn't fully supported by CDK's NLB construct yet although we can use [this workaround](https://github.com/aws/aws-cdk/issues/1490#issuecomment-1712248770) for now.

## Quickstart

```shell
npx cdk deploy --require-approval never --all
```

After deploying, you will see the NLB DNS name as an export `ServiceStack.LoadBalancerDnsName` in the terminal output.

You should now be able to curl it:

```
❯ curl -s Infra-NLB55-M0W06U37DTK1-c46f860f49d882ea.elb.us-east-1.amazonaws.com
<h1>Hello, World!</h1><h2>This is my axum service.</h2>
```

## Why are deployments so slow?

For me, each `cdk deploy` takes about 8 minutes. The main reason the deployments are slow is due to NLB target group registration / degistration times. Here is the official AWS guidance:

>**When you register a new target to your Network Load Balancer, it is expected to take between 3-5 minutes (180 and 300 seconds) to complete the registration process.** After registration is complete, the Network Load Balancer health check systems will begin to send health checks to the target. A newly registered target must pass health checks for the configured interval to enter service and receive traffic. For example, if you configure your health check for a 30 second interval, and require 3 health checks to become healthy, the minimum time a newly registered target could enter service is 270 seconds (**180 seconds for registration**, and another 90 (3*30) seconds for passing health checks) after a new target passes its first health check.
>
>**Similarly, when you deregister a target from your Network Load Balancer, it is expected to take 3-5 minutes (180-300 seconds) to process the requested deregistration, after which it will no longer receive new connections.** During this time the Elastic Load  Balancing API will report the target in 'draining' state. The target will continue to receive new connections until the deregistration processing has completed. At the end of the configured deregistration delay, the target will not be included in the describe-target-health response for the Target Group, and will return 'unused' with reason 'Target.NotRegistered' when querying for the specific target.

Here are some addtional links where folks have been running into the same issue:

- https://stackoverflow.com/questions/47256085/aws-network-elb-take-4-minutes-to-recognise-target-as-healthy
- https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/1834
- https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/3270
